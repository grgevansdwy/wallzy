/**
 * categoryNames.ts
 * ─────────────────
 * Single source of truth for mapping reward category keys → display names.
 * Used everywhere a category key needs to be shown to the user.
 *
 * Covers both camelCase keys (used by Gemini) and snake_case keys
 * (used in older DB entries) so both formats display correctly.
 */
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  // ── camelCase keys (Gemini categories) ──────────────────────────────────
  amazon: "Amazon",
  americanHeartAssociation: "American Heart Association",
  applePay: "Apple Pay",
  carRental: "Car Rental",
  cellPhone: "Cell Phone",
  delta: "Delta",
  departmentStore: "Department Store",
  dining: "Dining",
  disney: "Disney",
  drugstore: "Drugstore",
  electronicStore: "Electronic Store",
  entertainment: "Entertainment",
  everything: "Everything",
  fastFood: "Fast Food",
  fitnessClub: "Fitness Club",
  gas: "Gas",
  groceries: "Groceries",
  homeFurnishing: "Home Furnishing",
  homeUtilities: "Home Utilities",
  hotel: "Hotel",
  norwegianCruiseLine: "Norwegian Cruise Line",
  onlineRetail: "Online Retail",
  paypal: "Paypal",
  restaurant: "Restaurant",
  streaming: "Streaming",
  transit: "Transit",
  travel: "Travel",
  wholeFoods: "Whole Foods",
  wholesale: "Wholesale",
  flight: "Flight",

  // ── snake_case keys (legacy DB rule_keys) ───────────────────────────────
  gas_ev: "Gas",
  fast_food: "Fast Food",
  car_rental: "Car Rental",
  cell_phone: "Cell Phone",
  department_store: "Department Store",
  department_stores: "Department Store",
  electronic_store: "Electronic Store",
  electronic_stores: "Electronic Store",
  fitness_club: "Fitness Club",
  fitness_clubs: "Fitness Club",
  home_furnishing: "Home Furnishing",
  home_utilities: "Home Utilities",
  online_retail: "Online Retail",
  online_shopping: "Online Retail",
  apple_pay: "Apple Pay",
  streaming_subscription: "Streaming",
  streaming_internet_tv: "Streaming",
  grocery_stores: "Groceries",
  drug_stores: "Drugstore",
  home_improvement: "Home Furnishing",
  home_goods: "Home Furnishing",
};

/**
 * getCategoryDisplayName
 * ───────────────────────
 * Returns the display name for a category key.
 * Falls back to a best-effort title-case conversion if the key isn't in the map.
 *
 * Handles:
 *   camelCase  → "fastFood"        → "Fast Food"
 *   snake_case → "fast_food"       → "Fast Food"
 *   unknown    → "someNewCategory" → "Some New Category" (auto title-case)
 */
export function getCategoryDisplayName(key: string): string {
  if (!key) return "";

  // Direct lookup first (handles exact matches for both camelCase and snake_case)
  if (CATEGORY_DISPLAY_NAMES[key]) return CATEGORY_DISPLAY_NAMES[key];

  // snake_case → split on underscore, title-case each word
  if (key.includes("_")) {
    return key
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // camelCase → insert space before each uppercase letter
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
