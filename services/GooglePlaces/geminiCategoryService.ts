/**
 * geminiCategoryService.ts
 * ─────────────────────────
 * Uses Gemini AI to classify a Google place into one of Wallzy's reward
 * categories. Results are cached in the Supabase `mcc_google_cache` table
 * so each unique place is only ever sent to Gemini once.
 *
 * Flow:
 *   1. getCategoryByPlaceId(placeId) is called with a Google place_id
 *   2. We check Supabase cache first — if it's already there, return instantly
 *   3. Cache miss → call Google Place Details API to get name + types
 *   4. Send name + types to Gemini → Gemini picks the best category
 *   5. Save result to Supabase cache for future lookups
 *   6. Return the category
 */

import { supabase } from "@/lib/supabase";
import { getPlaceDetails } from "./autocompleteService";

/**
 * All valid Wallzy reward categories.
 * These must match the rule_keys used in the reward_rules table.
 * "everything" is the fallback when no specific category fits.
 */
const WALLZY_CATEGORIES = [
  "everything",
  "groceries",
  "dining",
  "gas",
  "streaming",
  "onlineRetail",
  "entertainment",
  "wholesale",
  "restaurant",
  "travel",
  "flight",
  "hotel",
  "transit",
  "departmentStore",
  "drugstore",
  "homeFurnishing",
  "fitnessClub",
  "cellPhone",
  "electronicStore",
  "fastFood",
  "homeUtilities",
  "carRental",
  "amazon",
  "americanHeartAssociation",
  "applePay",
  "delta",
  "disney",
  "norwegianCruiseLine",
  "paypal",
  "wholeFoods",
] as const;

/**
 * getCategoryByPlaceId
 * ─────────────────────
 * Main entry point. Takes a Google place_id and returns a Wallzy category.
 *
 * @param placeId - Google place ID (from autocomplete or text search)
 * @returns       - a category string like "dining", "groceries", etc.
 *                  Falls back to "everything" if Gemini fails.
 */
export async function getCategoryByPlaceId(placeId: string): Promise<string> {
  try {
    // ── Step 1: Check Supabase cache ─────────────────────────────────────────
    // The mcc_google_cache table stores previous Gemini lookups by place_id.
    // If we've seen this place before, return instantly without calling any API.
    const { data: cached } = await supabase
      .from("mcc_google_cache")
      .select("category")
      .eq("places_id", placeId)
      .maybeSingle();

    if (cached?.category) {
      return cached.category;
    }

    // ── Step 2: Cache miss — get place details from Google ───────────────────
    // We need the merchant name and Google types array to give Gemini context.
    const details = await getPlaceDetails(placeId);
    const merchantName = details?.name ?? "";
    const types = details?.types ?? [];

    // ── Step 3: Ask Gemini to classify the place ─────────────────────────────
    const category = await askGeminiForCategory(merchantName, types);

    // ── Step 4: Save to Supabase cache ───────────────────────────────────────
    // Ignore insert errors — a duplicate place_id will fail silently (UNIQUE constraint),
    // which is fine since the result would be the same anyway.
    await supabase.from("mcc_google_cache").insert({
      places_id: placeId,
      merchant_name: merchantName,
      category,
      google_types: types,
    });

    return category;
  } catch {
    return "everything";
  }
}

/**
 * askGeminiForCategory
 * ─────────────────────
 * Internal function — sends merchant name + Google types to Gemini and
 * asks it to pick exactly one Wallzy category from the list.
 *
 * Uses gemini-1.5-flash (fast + cheap — ideal for real-time lookups).
 *
 * @param merchantName - e.g. "Starbucks", "CVS Pharmacy"
 * @param types        - Google Places types e.g. ["cafe", "food", "store"]
 * @returns            - one of the WALLZY_CATEGORIES strings
 */
async function askGeminiForCategory(
  merchantName: string,
  types: string[],
): Promise<string> {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return "everything";
    }

    const prompt = `You are a credit card rewards categorization assistant.

Merchant name: "${merchantName}"
Google Places types: [${types.join(", ")}]

Pick exactly ONE category from this list that best fits this merchant:
${WALLZY_CATEGORIES.join(", ")}

Guidelines:
- "restaurant" → sit-down restaurants (full service dining)
- "fastFood" → fast food chains (McDonald's, Taco Bell, Subway, etc.)
- "dining" → cafes, bars, bakeries, coffee shops, casual food
- "groceries" → supermarkets, grocery stores (Walmart Grocery, Whole Foods, Trader Joe's)
- "departmentStore" → general merchandise stores (Target, Walmart, Costco)
- "wholesale" → warehouse clubs (Costco, Sam's Club, BJ's)
- "drugstore" → pharmacies (CVS, Walgreens, Rite Aid)
- "gas" → gas stations and EV charging stations
- "travel" → general travel spending (hotels, airlines, agencies combined)
- "flight" → airlines specifically
- "hotel" → hotels and lodging specifically
- "carRental" → car rental companies
- "transit" → public transit, parking, rideshare
- "entertainment" → movies, theme parks, sports venues, museums
- "homeFurnishing" → furniture, home goods, hardware stores (IKEA, Home Depot, Lowe's)
- "electronicStore" → electronics retailers (Best Buy, Apple Store)
- "fitnessClub" → gyms and fitness centers
- "streaming" → streaming services (Netflix, Spotify, Hulu)
- "cellPhone" → mobile carriers and phone plans
- "homeUtilities" → utilities, internet, cable, phone bills
- "onlineRetail" → online-only retailers (Amazon, eBay)
- "everything" → fallback if nothing else fits

Respond with ONLY the category name, nothing else.`;

    // Use raw fetch instead of the SDK — the SDK pins an old API version
    // that doesn't support newer models. Raw fetch always uses the latest endpoint.
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
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    // Validate Gemini returned one of our known categories (case-insensitive check)
    const matched = WALLZY_CATEGORIES.find(
      (c) => c.toLowerCase() === text.toLowerCase(),
    );

    if (!matched) {
      return "everything";
    }

    return matched;
  } catch {
    return "everything";
  }
}
