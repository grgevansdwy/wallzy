import { supabase } from "@/lib/supabase";

export interface BestCardResult {
  card_key: string;
  card_name: string;
  reward_rate: number;
  is_custom: boolean;
  card_photo: string | null;
}

export interface CardRecommendation {
  bestCards: BestCardResult[];
  estimatedRewards: number;
  isSignupBonus?: boolean; // true when result is driven by an active sign-up bonus
}

/**
 * Category hierarchy — if a place is tagged "restaurant", also check the
 * parent "dining" rule so cards with a dining bonus still get credit.
 */
const CATEGORY_PARENTS: Record<string, string[]> = {
  restaurant: ["restaurant", "dining"],
  hotel: ["hotel", "travel"],
  flight: ["flight", "travel"],
  fastFood: ["fastFood", "dining"],
  fast_food: ["fast_food", "dining"],
};

function categoryHierarchy(category: string): string[] {
  return CATEGORY_PARENTS[category] ?? [category];
}

/**
 * Find the best credit card(s) for a given category.
 * Returns ALL cards that tie for the maximum reward rate.
 *
 * This is implemented entirely in TypeScript (no SQL RPC) so that every
 * user_custom_card lookup is explicitly filtered by user_id. The previous
 * SQL function was joining user_custom_card on card_key alone, which caused
 * one user's configured category to bleed into another user's results.
 *
 * Priority order per card:
 * 1. Sign-up bonus override (beats everything)
 * 2. User's own custom reward that matches the query category
 * 3. Default reward_rules for specific category
 * 4. Default reward_rules for parent category (restaurant → dining, etc.)
 * 5. User's custom base rate (everything override)
 * 6. Default base rate (everything rule)
 */
export async function chooseBestCard(
  userId: string,
  category: string,
  amount: number = 0,
): Promise<CardRecommendation> {
  try {
    // ── Step 0: Sign-up bonus override ───────────────────────────────────────
    // If this user has activated a sign-up bonus on any card, that card wins
    // with a flat 20% rate regardless of category.
    const { data: bonusRows } = await supabase
      .from("user_custom_card")
      .select("card_key")
      .eq("user_id", userId)
      .eq("rule_key", "signup_bonus");

    if (bonusRows && bonusRows.length > 0) {
      const bonusCardKey = bonusRows[0].card_key;
      const { data: cardData } = await supabase
        .from("cards")
        .select("card_key, card_name, card_photo, bonus_value, bonus_spending")
        .eq("card_key", bonusCardKey)
        .single();

      if (cardData) {
        // Effective rate = bonus_value / bonus_spending
        // e.g. $1750 bonus / $8000 required spend = 21.875% effective return
        const bonusValue = Number(cardData.bonus_value) || 0;
        const bonusSpending = Number(cardData.bonus_spending) || 1;
        const effectiveRate =
          bonusValue > 0 && bonusSpending > 0
            ? bonusValue / bonusSpending
            : 0.2; // fallback if card has no bonus fields

        return {
          bestCards: [
            {
              card_key: cardData.card_key,
              card_name: cardData.card_name,
              reward_rate: effectiveRate,
              is_custom: true,
              card_photo: cardData.card_photo ?? null,
            },
          ],
          estimatedRewards: amount * effectiveRate,
          isSignupBonus: true,
        };
      }
    }

    // ── Step 1: Get this user's cards ─────────────────────────────────────────
    const { data: userCardRows } = await supabase
      .from("user_cards")
      .select("card_key")
      .eq("user_id", userId);

    const userCardKeys: string[] = (userCardRows ?? []).map(
      (r: any) => r.card_key,
    );
    if (!userCardKeys.length) {
      return { bestCards: [], estimatedRewards: 0 };
    }

    const hierarchy = categoryHierarchy(category);
    const allCats = [...hierarchy, "everything"];

    // ── Step 2: Get THIS user's custom rewards (filtered by user_id!) ─────────
    // This is the critical fix: always filter by user_id so we never read
    // another user's configured category for the same card.
    const { data: customRows } = await supabase
      .from("user_custom_card")
      .select("card_key, rule_key, reward_rate")
      .eq("user_id", userId)
      .in("card_key", userCardKeys)
      .neq("rule_key", "signup_bonus");

    // card_key → all custom entries for that card (this user only)
    const customByCard = new Map<
      string,
      { rule_key: string; reward_rate: number }[]
    >();
    (customRows ?? []).forEach((r: any) => {
      if (!customByCard.has(r.card_key)) customByCard.set(r.card_key, []);
      customByCard
        .get(r.card_key)!
        .push({ rule_key: r.rule_key, reward_rate: r.reward_rate });
    });
    // ── Step 3: Get default reward_rules for matching categories ──────────────
    // IMPORTANT: exclude rule_type="custom"/"top"/"cta" — those rows are just
    // the OPTIONS MENU for configurable categories (e.g. the list of categories
    // a user can assign to bofa_custom). The actual chosen category lives in
    // user_custom_card (Step 2 above). Reading these rows as real reward rates
    // caused bofa_custom to win for ANY category it offered as an option.
    //
    // NOTE: We fetch all rows and filter in TypeScript rather than using
    // .not("rule_type", "in", "...") in SQL. In PostgreSQL, NULL NOT IN (...)
    // evaluates to NULL (not TRUE), so a SQL filter would silently exclude rows
    // where rule_type IS NULL — which are the standard reward rate rows.
    const { data: ruleRows } = await supabase
      .from("reward_rules")
      .select("card_key, rule_key, reward_rate, rule_type")
      .in("card_key", userCardKeys)
      .in("rule_key", allCats);

    const EXCLUDED_RULE_TYPES = ["custom", "top", "cta"];

    // card_key → rule_key → reward_rate
    const rulesByCard = new Map<string, Map<string, number>>();
    (ruleRows ?? [])
      .filter((r: any) => !EXCLUDED_RULE_TYPES.includes(r.rule_type))
      .forEach((r: any) => {
        if (!rulesByCard.has(r.card_key))
          rulesByCard.set(r.card_key, new Map());
        rulesByCard.get(r.card_key)!.set(r.rule_key, r.reward_rate);
      });

    // ── Step 4: Get card display info ─────────────────────────────────────────
    const { data: cardInfoRows } = await supabase
      .from("cards")
      .select("card_key, card_name, card_photo")
      .in("card_key", userCardKeys);

    const cardInfo = new Map<
      string,
      { card_name: string; card_photo: string | null }
    >();
    (cardInfoRows ?? []).forEach((c: any) =>
      cardInfo.set(c.card_key, {
        card_name: c.card_name,
        card_photo: c.card_photo ?? null,
      }),
    );

    // ── Step 5: Calculate effective rate per card and find the winner(s) ──────
    let bestRate = -1;
    const winners: BestCardResult[] = [];

    for (const cardKey of userCardKeys) {
      const custom = customByCard.get(cardKey) ?? [];
      const rules = rulesByCard.get(cardKey);
      const info = cardInfo.get(cardKey);
      if (!info) continue;

      let effectiveRate = 0;
      let isCustom = false;

      // Does any of this user's configured categories match the query category?
      const matchingCustom = custom
        .filter(
          (e) => e.rule_key !== "everything" && hierarchy.includes(e.rule_key),
        )
        .sort((a, b) => b.reward_rate - a.reward_rate)[0];

      if (matchingCustom) {
        // User has this card set to a category that matches — use their custom rate
        effectiveRate = matchingCustom.reward_rate;
        isCustom = true;
      } else {
        // User's configured category doesn't match (or card has no custom config).
        // Check fixed default rules, most specific category first.
        for (const cat of hierarchy) {
          if (rules?.has(cat)) {
            effectiveRate = rules.get(cat)!;
            break;
          }
        }

        // Still nothing — fall back to base rate (user override → DB default)
        if (effectiveRate === 0) {
          const customBase = custom.find((e) => e.rule_key === "everything");
          effectiveRate =
            customBase?.reward_rate ?? rules?.get("everything") ?? 0;
        }
      }

      if (effectiveRate > bestRate) {
        bestRate = effectiveRate;
        winners.length = 0;
        winners.push({
          card_key: cardKey,
          card_name: info.card_name,
          reward_rate: effectiveRate,
          is_custom: isCustom,
          card_photo: info.card_photo,
        });
      } else if (effectiveRate === bestRate && effectiveRate > 0) {
        winners.push({
          card_key: cardKey,
          card_name: info.card_name,
          reward_rate: effectiveRate,
          is_custom: isCustom,
          card_photo: info.card_photo,
        });
      }
    }

    if (!winners.length) return { bestCards: [], estimatedRewards: 0 };

    return { bestCards: winners, estimatedRewards: amount * bestRate };
  } catch (error) {
    throw error;
  }
}

/**
 * Returns all Wallzy reward category keys.
 * Previously queried the mcc_conversion table, but since Gemini already
 * returns these exact keys directly, the table is no longer needed.
 */
export function getAvailableCategories(): string[] {
  return [
    "carRental",
    "cellPhone",
    "departmentStore",
    "dining",
    "drugstore",
    "electronicStore",
    "entertainment",
    "everything",
    "fastFood",
    "fitnessClub",
    "flight",
    "gas",
    "groceries",
    "homeFurnishing",
    "homeUtilities",
    "hotel",
    "onlineRetail",
    "restaurant",
    "streaming",
    "transit",
    "travel",
    "wholesale",
  ];
}
