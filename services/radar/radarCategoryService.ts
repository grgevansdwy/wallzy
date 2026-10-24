/**
 * radarCategoryService.ts
 * ────────────────────────
 * This file bridges the gap between what Radar knows about a place
 * and what Wallzy's reward engine understands.
 *
 * THE PROBLEM:
 *   Radar gives us categories like "food-beverage" or "retail".
 *   Wallzy's reward rules use categories like "dining" or "groceries".
 *   These don't match — we need a translator.
 *
 * THE SOLUTION:
 *   We send the merchant name + Radar categories to Gemini AI.
 *   Gemini reads the context and picks the best matching Wallzy category.
 *   e.g. "Starbucks" + ["food-beverage", "coffee-shop"] → "dining"
 *        "Costco"    + ["grocery", "wholesale"]         → "wholesale"
 *        "Shell"     + ["gas-station"]                  → "gas"
 *
 * THE CACHE:
 *   Calling Gemini for every location visit would be slow and cost money.
 *   So we save each result to the `mcc_radar_cache` table in Supabase.
 *   Next time we see the same Radar place ID, we return instantly from cache.
 */

import { supabase } from "@/lib/supabase";

// ── Valid Wallzy reward categories ───────────────────────────────────────────
// These are the exact rule_key strings used in the reward_rules Supabase table.
// Gemini MUST return one of these — if it returns anything else, we fall back
// to "everything" (the generic catch-all that uses the card's base reward rate).
const WALLZY_CATEGORIES = [
  "everything",       // catch-all / base rate — used when nothing specific matches
  "groceries",        // supermarkets and grocery stores
  "dining",           // cafes, bars, bakeries, coffee shops (casual food)
  "gas",              // petrol stations and EV charging
  "streaming",        // Netflix, Spotify, Disney+, etc.
  "onlineRetail",     // Amazon, eBay, online-only shopping
  "entertainment",    // cinemas, museums, sports venues, theme parks
  "wholesale",        // Costco, Sam's Club, BJ's Wholesale
  "restaurant",       // sit-down full-service restaurants
  "travel",           // general travel catch-all (hotel + flight + rental)
  "flight",           // airlines specifically
  "hotel",            // hotels and lodging
  "transit",          // public transit, Uber/Lyft, parking
  "departmentStore",  // Target, Walmart, general merchandise
  "drugstore",        // CVS, Walgreens, Rite Aid
  "homeFurnishing",   // IKEA, Home Depot, furniture stores
  "fitnessClub",      // gyms, yoga, fitness studios
  "cellPhone",        // mobile carriers and phone plan payments
  "electronicStore",  // Best Buy, Apple Store, electronics retailers
  "fastFood",         // McDonald's, Taco Bell, Chick-fil-A, etc.
  "homeUtilities",    // electricity, internet, cable bills
  "carRental",        // Enterprise, Hertz, Avis, etc.
] as const;

// ── Main exported function ───────────────────────────────────────────────────
/**
 * getCategoryByRadarPlace
 *
 * This is the only function called from outside this file.
 * It takes a Radar place and returns the Wallzy rule_key for it.
 *
 * @param radarId         - Radar's unique place ID (used as the Supabase cache key)
 * @param merchantName    - Human-readable name e.g. "Starbucks", "Whole Foods"
 * @param radarCategories - Tags Radar assigned to the place e.g. ["food-beverage"]
 * @returns               - A Wallzy rule_key like "dining", "groceries", "gas", etc.
 *                          Always returns something — worst case "everything"
 */
export async function getCategoryByRadarPlace(
  radarId: string,
  merchantName: string,
  radarCategories: string[],
): Promise<string> {
  try {
    // ── Step 1: Check the Supabase cache first ────────────────────────────────
    // mcc_radar_cache table stores past Gemini results keyed by radar_id.
    // If we've seen this exact place before, return immediately — no AI call needed.
    const { data: cached } = await supabase
      .from("mcc_radar_cache")
      .select("rule_key")       // we only need the category, not the full row
      .eq("radar_id", radarId)  // match by Radar's place ID
      .maybeSingle();           // returns null instead of throwing if no row found

    if (cached?.rule_key) {
      // Cache hit — this place was already classified before
      return cached.rule_key;
    }

    // ── Step 2: Cache miss — ask Gemini ──────────────────────────────────────
    // First time we've seen this place, so we need to classify it with AI.
    const ruleKey = await askGeminiForCategory(merchantName, radarCategories);

    // ── Step 3: Save the result to cache for next time ────────────────────────
    // We store the full context (name, radar categories) so we can audit it later
    // if a place is being categorized wrong.
    const { error: insertError } = await supabase.from("mcc_radar_cache").insert({
      id: crypto.randomUUID(),                     // generate UUID since column has no default
      radar_id: radarId,                          // primary lookup key
      name: merchantName,                          // for human readability in the DB
      rule_key: ruleKey,                           // the Wallzy category we chose
      radar_category: radarCategories.join(", "), // original Radar tags, for debugging
    });
    if (insertError) {
      console.error("[RadarCategory] Cache insert failed:", insertError.message, insertError.code);
    }

    return ruleKey;
  } catch (error) {
    // If anything fails (network, Supabase, Gemini), fall back to "everything"
    // so the user still gets a recommendation — just at the base reward rate.
    console.error("[RadarCategory] getCategoryByRadarPlace failed:", error);
    return "everything";
  }
}

// ── Internal AI call ─────────────────────────────────────────────────────────
/**
 * askGeminiForCategory
 *
 * Sends a structured prompt to Gemini asking it to classify the merchant.
 * The prompt gives Gemini:
 *   - The merchant name (most important signal)
 *   - Radar's category tags (supporting context)
 *   - The full list of valid Wallzy categories to choose from
 *   - Plain-English guidelines for edge cases (restaurant vs fastFood, etc.)
 *
 * Gemini is instructed to reply with ONLY the category name — no explanation.
 * We then verify the reply is one of our valid categories before returning it.
 */
async function askGeminiForCategory(
  merchantName: string,
  radarCategories: string[],
): Promise<string> {
  try {
    // Read the Gemini API key from the environment (set in .env / .xcode.env.local)
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[RadarCategory] EXPO_PUBLIC_GEMINI_API_KEY not set");
      return "everything"; // can't call Gemini without a key
    }

    // Build the prompt. The more specific the guidelines, the more accurate Gemini is.
    // Edge cases like restaurant vs fastFood vs dining need explicit examples.
    const prompt = `You are a credit card rewards categorization assistant.

Merchant name: "${merchantName}"
Radar place categories: [${radarCategories.join(", ")}]

Pick exactly ONE category from this list that best fits this merchant:
${WALLZY_CATEGORIES.join(", ")}

Guidelines:
- "restaurant" → sit-down restaurants (full service dining)
- "fastFood" → fast food chains (McDonald's, Taco Bell, Subway, etc.)
- "dining" → cafes, bars, bakeries, coffee shops, casual food
- "groceries" → supermarkets, grocery stores
- "departmentStore" → general merchandise stores (Target, Walmart)
- "wholesale" → warehouse clubs (Costco, Sam's Club, BJ's)
- "drugstore" → pharmacies (CVS, Walgreens, Rite Aid)
- "gas" → gas stations and EV charging
- "travel" → general travel (hotels, airlines, agencies combined)
- "flight" → airlines specifically
- "hotel" → hotels and lodging specifically
- "carRental" → car rental companies
- "transit" → public transit, parking, rideshare
- "entertainment" → movies, theme parks, sports venues, museums
- "homeFurnishing" → furniture, home goods, hardware (IKEA, Home Depot)
- "electronicStore" → electronics retailers (Best Buy, Apple Store)
- "fitnessClub" → gyms and fitness centers
- "streaming" → streaming services (Netflix, Spotify, Hulu)
- "cellPhone" → mobile carriers and phone plans
- "homeUtilities" → utilities, internet, cable, phone bills
- "onlineRetail" → online-only retailers (Amazon, eBay)
- "everything" → fallback if nothing else fits

Respond with ONLY the category name, nothing else.`;

    // POST to Gemini's REST API (gemini-2.5-flash is fast and cheap for short tasks)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();

    // Navigate Gemini's nested response structure to get the text reply.
    // candidates[0].content.parts[0].text is where the actual answer lives.
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    // Verify Gemini returned something we recognise (case-insensitive match).
    // If Gemini hallucinated a category name, matched will be undefined.
    const matched = WALLZY_CATEGORIES.find(
      (c) => c.toLowerCase() === text.toLowerCase(),
    );

    if (!matched) {
      // Gemini returned something unexpected — don't trust it, use "everything"
      console.warn("[RadarCategory] Gemini returned unknown category:", text, "— falling back to everything");
      return "everything";
    }

    return matched; // e.g. "dining", "groceries", "gas"
  } catch (error) {
    console.error("[RadarCategory] Gemini API call failed:", error);
    return "everything"; // safe fallback so the app never crashes here
  }
}
