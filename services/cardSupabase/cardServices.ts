import { supabase } from "@/lib/supabase";
import { Card, UserCustomCard } from "@/types/database";

// Static popular banks
export const POPULAR_BANKS = [
  { id: "bofa", name: "Bank of America", shortName: "Bank of America" },
  { id: "chase", name: "Chase", shortName: "Chase" },
  { id: "discover", name: "Discover", shortName: "Discover" },
  { id: "amex", name: "American Express", shortName: "Amex" },
  { id: "capitalone", name: "Capital One", shortName: "Capital One" },
  { id: "citi", name: "Citi", shortName: "Citi" },
];

// Attaches base_reward to each card by looking up the "everything" rule_key in reward_rules
async function attachBaseRewards(cards: Card[]): Promise<Card[]> {
  if (cards.length === 0) return cards;
  const cardKeys = cards.map((c) => c.card_key);
  const { data: rules } = await supabase
    .from("reward_rules")
    .select("card_key, reward_rate")
    .in("card_key", cardKeys)
    .eq("rule_key", "everything");
  const rateMap = new Map<string, number>();
  (rules || []).forEach((r: any) => rateMap.set(r.card_key, r.reward_rate));
  return cards.map((card) => ({
    ...card,
    base_reward: rateMap.get(card.card_key) ?? 0,
  }));
}

export async function fetchAllCards(): Promise<Card[]> {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .order("card_name");

  if (error) {
    throw error;
  }

  return attachBaseRewards(data || []);
}

export async function fetchCardsByBank(bankName: string): Promise<Card[]> {
  // Use ilike for flexible matching (Citibank matches Citi, etc.)
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .ilike("issuing_bank", `%${bankName}%`)
    .order("card_name");

  if (error) {
    throw error;
  }

  return attachBaseRewards(data || []);
}

export async function fetchCardByKey(cardKey: string): Promise<Card | null> {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("card_key", cardKey)
    .single();

  if (error) {
    throw error;
  }

  if (!data) return null;
  const [card] = await attachBaseRewards([data]);
  return card;
}

// User Cards functions
export async function fetchUserCards(userId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from("user_cards")
    .select(
      `
      card_key,
      cards (
        card_key,
        card_name,
        issuing_bank,
        foreign_fee,
        annual_fee,
        rewards_type,
        network,
        card_photo,
        bonus_value,
        bonus_spending,
        bonus_time,
        comment_bonus,
        comment_general
      )
    `,
    )
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  // Extract the nested cards data and attach base rewards
  const cards = (data || []).map((item: any) => item.cards).filter(Boolean);
  return attachBaseRewards(cards);
}

export async function addUserCard(
  userId: string,
  cardKey: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_cards")
    .insert({ user_id: userId, card_key: cardKey });

  if (error) {
    throw error;
  }
}

export async function removeUserCard(
  userId: string,
  cardKey: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_cards")
    .delete()
    .eq("user_id", userId)
    .eq("card_key", cardKey);

  if (error) {
    throw error;
  }
}

export async function checkUserHasCard(
  userId: string,
  cardKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_cards")
    .select("id")
    .eq("user_id", userId)
    .eq("card_key", cardKey)
    .maybeSingle();

  if (error) {
    return false;
  }

  return data !== null;
}

// Create user record when they sign up
export async function createUserRecord(
  userId: string,
  _email?: string,
): Promise<void> {
  const { error } = await supabase
    .from("users")
    .insert({
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    // If user already exists (code 23505 = unique constraint), that's fine
    if (error.code !== "23505") {
      throw error;
    }
  }
}

// Custom Rewards functions
export async function fetchCustomRewards(
  userId: string,
  cardKey: string,
): Promise<UserCustomCard[]> {
  const { data, error } = await supabase
    .from("user_custom_card")
    .select("*")
    .eq("user_id", userId)
    .eq("card_key", cardKey);

  if (error) {
    return [];
  }

  return data || [];
}

export async function saveCustomReward(
  userId: string,
  cardKey: string,
  ruleKey: string,
  rewardRate: number,
): Promise<void> {
  // Check if custom reward already exists
  const { data: existing } = await supabase
    .from("user_custom_card")
    .select("id")
    .eq("user_id", userId)
    .eq("card_key", cardKey)
    .eq("rule_key", ruleKey)
    .maybeSingle();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("user_custom_card")
      .update({ reward_rate: rewardRate })
      .eq("id", existing.id);

    if (error) {
      throw error;
    }
  } else {
    // Insert new
    const { error } = await supabase.from("user_custom_card").insert({
      user_id: userId,
      card_key: cardKey,
      rule_key: ruleKey,
      reward_rate: rewardRate,
    });

    if (error) {
      throw error;
    }
  }
}

export async function deleteAllCustomRewardsForCard(
  userId: string,
  cardKey: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_custom_card")
    .delete()
    .eq("user_id", userId)
    .eq("card_key", cardKey);

  if (error) {
    throw error;
  }
}

export async function submitCardRequest(cardName: string): Promise<void> {
  const { error } = await supabase
    .from("request_card")
    .insert({ user_request: cardName });

  if (error) {
    throw error;
  }
}

export async function deleteCustomReward(
  userId: string,
  cardKey: string,
  ruleKey: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_custom_card")
    .delete()
    .eq("user_id", userId)
    .eq("card_key", cardKey)
    .eq("rule_key", ruleKey);

  if (error) {
    throw error;
  }
}
