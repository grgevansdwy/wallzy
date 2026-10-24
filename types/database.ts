export interface Card {
  card_key: string;
  card_name: string;
  issuing_bank: string;
  base_reward: number;
  foreign_fee: string | null;
  annual_fee: number;
  rewards_type: string;
  network: string;
  card_photo: string | null;
  bonus_value: number | null;
  bonus_spending: number | null;
  bonus_time: number | null;
  comment_bonus: string | null;
  comment_general: string | null;
}

export interface RewardRule {
  id: number;
  card_key: string;
  rule_key: string;
  reward_rate: number;
  rule_type: string | null;
  comment: string | null;
  modal_title: string | null;
  modal_body: string | null;
}

export interface UserCard {
  id: number;
  user_id: string;
  card_key: string;
}

export interface UserCustomCard {
  id: number;
  user_id: string;
  card_key: string;
  rule_key: string;
  reward_rate: number;
}
