import os
import re
import json
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

SCRAPER_DIR = os.path.dirname(os.path.abspath(__file__))

# Load .env from repo root
load_dotenv(Path(SCRAPER_DIR).parent.parent / ".env", override=True)

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Category remapping (handles any leftover old keys) ──────────────────────
CATEGORY_MAP = {
    "base": "everything",
    "grocery": "groceries", "grocery_stores": "groceries",
    "groceries_us_supermarkets": "groceries", "online_grocery": "groceries",
    "restaurants": "dining", "uber_eats": "dining",
    "gas": "gas_ev", "gas_station": "gas_ev", "gas_stations": "gas_ev",
    "ev_charging": "gas_ev", "chargepoint": "gas_ev", "exxon_mobil": "gas_ev",
    "streaming": "streaming_subscription", "streaming_services": "streaming_subscription",
    "streaming_select": "streaming_subscription",
    "online_shopping": "online_retail", "nike": "online_retail",
    "paypal_online_checkout": "online_retail",
    "capital_one_entertainment": "entertainment", "entertainment_capital": "entertainment",
    "live_entertainment": "entertainment", "attractions_citi": "entertainment",
    "american_heart_association": "entertainment",
    "wholesale_club": "wholesale", "wholesale_clubs": "wholesale",
    "travel_amex": "travel", "travel_chase": "travel", "travel_select": "travel",
    "travel_other": "travel",
    "flight_capital": "flight", "flights_direct_amextravel": "flight",
    "flights_direct_or_amex_travel": "flight", "delta_purchases": "flight",
    "hotel_amex": "hotel", "hotel_capital": "hotel", "hotel_citi": "hotel",
    "hotel_us_bank": "hotel", "booking_com": "hotel",
    "vacation_rental_capital": "hotel", "norwegian_cruise_line": "hotel",
    "lyft": "transit", "uber": "transit", "transit_select": "transit",
    "drug_stores": "drugstore", "drugstores": "drugstore", "pharmacy": "drugstore",
    "duane_reade": "drugstore", "walgreens": "drugstore",
    "furnishing": "home_furnishing", "home_improvement": "home_furnishing",
    "ace_hardware": "home_furnishing",
    "fitness_clubs": "fitness_club", "peloton": "fitness_club",
    "phone_plans": "cell_phone",
    "apple": "electronic_store",
    "cable": "home_utilities", "internet": "home_utilities",
    "car_rental_capital": "car_rental", "car_rental_citi": "car_rental",
    "car_rental_us_bank": "car_rental", "hertz": "car_rental",
}

def remap(d: dict) -> dict:
    out = {}
    for k, v in d.items():
        new_k = CATEGORY_MAP.get(k, k)
        out[new_k] = max(out[new_k], v) if new_k in out else v
    return out

def make_card_id(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r'[®™©]', '', slug)
    slug = re.sub(r'[^a-z0-9]+', '_', slug)
    return slug.strip('_')

def upload_card(card_id: str, card_name: str, c: dict) -> bool:
    """Upload a single card to Supabase. Returns True on success."""
    if not c:
        return False

    # Remap any leftover old category keys
    rewards = remap(c.get("rewards") or {})
    custom  = remap(c.get("custom") or {})
    rotating = {}
    for quarter, cats in (c.get("rotating") or {}).items():
        rotating[quarter] = remap(cats)

    # ── Insert into scrape_cards ──────────────────────────────────────
    rewards_type = c.get("rewards_type", "")
    bonus_val = c.get("bonus_value")
    if bonus_val is not None and rewards_type == "Point":
        bonus_val = int(bonus_val) // 100

    card_row = {
        "card_id":        card_id,
        "card_name":      card_name,
        "issuing_bank":   c.get("issuing_bank"),
        "annual_fee":     c.get("annual_fee"),
        "foreign_fee":    c.get("foreign_fee"),
        "reward_type":    rewards_type,
        "bonus_value":    int(bonus_val) if bonus_val is not None else None,
        "bonus_time":     int(c["bonus_time"]) if c.get("bonus_time") is not None else None,
        "bonus_spending": int(c["bonus_spending"]) if c.get("bonus_spending") is not None else None,
        "comment_bonus":  c.get("bonus_comment"),
        "comment_general": c.get("general_comment"),
        "status":         False,
    }

    supabase.table("scrape_cards").upsert(card_row, on_conflict="card_id").execute()
    print(f"  [{card_id}] card row inserted")

    # ── Insert into scrape_reward_rules ───────────────────────────────
    rules = []

    for rule_key, rate in rewards.items():
        rules.append({"card_id": card_id, "rule_key": rule_key, "reward_rate": rate, "rule_type": "fixed", "status": False})

    for rule_key, rate in custom.items():
        rules.append({"card_id": card_id, "rule_key": rule_key, "reward_rate": rate, "rule_type": "custom", "status": False})

    for quarter, cats in rotating.items():
        for rule_key, rate in cats.items():
            rules.append({"card_id": card_id, "rule_key": rule_key, "reward_rate": rate, "rule_type": f"rotating_{quarter}", "status": False})

    if rules:
        supabase.table("scrape_reward_rules").delete().eq("card_id", card_id).execute()
        supabase.table("scrape_reward_rules").insert(rules).execute()
        print(f"  [{card_id}] {len(rules)} reward rule(s) inserted")

    return True


if __name__ == "__main__":
    with open(os.path.join(SCRAPER_DIR, "card.json")) as f:
        cards = json.load(f)
    with open(os.path.join(SCRAPER_DIR, "resource.json")) as f:
        resource = json.load(f)

    total = len([c for c in cards.values() if c])
    print(f"Found {total} cards to upload.\n")

    # Wipe existing data before inserting fresh
    print("Deleting all rows from scrape_reward_rules...")
    supabase.table("scrape_reward_rules").delete().gte("card_id", "").execute()
    print("Deleting all rows from scrape_cards...")
    supabase.table("scrape_cards").delete().gte("card_id", "").execute()
    print("Tables cleared.\n")

    for card_id, c in cards.items():
        if not c:
            print(f"  Skipping (null): {card_id}")
            continue
        # Use the canonical name from resource.json, fall back to scraped name
        card_name = resource.get(card_id, {}).get("name") or c.get("card_name", card_id)
        upload_card(card_id, card_name, c)

    print(f"\nDone. {total} cards uploaded.")
