import os
import re
import json
import time
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai.errors import ClientError

SCRAPER_DIR = os.path.dirname(os.path.abspath(__file__))

# Load .env from repo root (two levels up from services/Scraper/)
load_dotenv(Path(SCRAPER_DIR).parent.parent / ".env", override=True)

EXPO_PUBLIC_GEMINI_API_KEY = os.environ.get("EXPO_PUBLIC_GEMINI_API_KEY", "")

# Curly braces in the schema are doubled ({{ }}) to escape Python's str.format()
PROMPT_TEMPLATE = """
You are a credit card data extraction assistant. Below is scraped text from a credit card product page (and any linked pricing/terms pages).

Extract the following fields and return ONLY a valid JSON object — no markdown, no explanation, just raw JSON.

Rules:
- Use null for any field you cannot find clear evidence for in the scraped text.
- card_name: the card name WITHOUT the issuer name (e.g. "Blue Cash Preferred" not "Amex Blue Cash Preferred")
- issuing_bank: the bank or financial institution that issues the card
- rewards_type: exactly "Cash", "Point", or "Miles"
- rewards: all earn rates as DECIMAL NUMBERS. 1% = 0.01, 2% = 0.02, 3% = 0.03, 5% = 0.05. For points/miles cards: 1x = 0.01, 2x = 0.02, 3x = 0.03. Key "base" is the catch-all default. Other keys are named spend categories.
- rotating: quarterly rotating bonus categories. Each quarter is a key like "q1_2025" whose value is an object of {{category: decimal_rate}} pairs. Leave as {{}} if no rotating categories.
- custom: customer-selectable categories. Object of {{category: decimal_rate}} pairs. Leave as {{}} if not applicable.
- annual_fee: an INTEGER (no $ sign). 0 if free, 95 for $95/year, etc. For intro offers like "$0 first year then $95", use 95 (the regular fee) and mention the intro in general_comment. Use null if unknown.
- foreign_fee: "No" if no foreign transaction fee, "X%" if there is one (e.g. "3%"), null if you cannot find this clearly stated
- bonus_value: the welcome bonus as a NUMBER only — no units, no $ sign, no "points"/"miles" suffix (e.g. 200 for $200, 75000 for 75000 points). Use null if no standard bonus.
- bonus_time: the spending window as a NUMBER only — no "month" suffix (e.g. 3 for 3 months). Use null if not a standard spend-in-X-months offer.
- bonus_spending: the minimum spend as a NUMBER only — no $ sign (e.g. 4000 for $4000). Use null if not applicable.
- bonus_comment: ALWAYS include a 1-sentence plain-English description. Keep it concise. If there is a standard welcome bonus, describe it (e.g. "Earn $200 after spending $2000 in the first 3 months"). If the bonus is non-standard (e.g. statement credit for autopay), describe it and set bonus_value/bonus_time/bonus_spending to null. If there is NO bonus at all, write "No welcome bonus."
- general_comment: 2-3 sentences on how the card works and what makes it notable

Category naming rules:
- Use ONLY these standard category keys. Map everything to the closest match:
  everything, groceries, dining, gas_ev, streaming_subscription, online_retail,
  entertainment, wholesale, restaurant, travel, flight, hotel, transit, drugstore,
  home_furnishing, fitness_club, cell_phone, electronic_store, fast_food, home_utilities,
  car_rental, apple_pay
- Split combined categories. WRONG: "hotels_and_rental_cars": 5.0  RIGHT: "hotel": 5.0, "car_rental": 5.0
- Issuer-specific portals: strip the issuer suffix and use the standard key.
  "hotel via Chase Travel" → "hotel", "rental cars via Capital One" → "car_rental"
- Mappings to remember: gas/ev_charging → gas_ev, pharmacy/walgreens → drugstore,
  streaming → streaming_subscription, uber/lyft → transit, uber_eats → dining,
  online_shopping → online_retail, home_improvement → home_furnishing,
  fitness/peloton → fitness_club, cable/internet → home_utilities, base → everything

Special rules:
- Discover cards: Their welcome offer is "Cashback Match" (Discover matches all cashback earned in the first year automatically). This is NOT a standard spend-X-in-Y-months bonus. Set bonus_value, bonus_time, and bonus_spending all to null. Describe the Cashback Match in bonus_comment. Discover cards are issued by Discover Financial Services — NOT Capital One.
- Apple Card: Each merchant with a 3% Daily Cash rate gets its own key in rewards (e.g. "apple": 0.03, "nike": 0.03, "uber": 0.03). The 2% Apple Pay rate goes under "apple_pay": 0.02.
- Non-standard bonuses (e.g. "earn $25 statement credit for setting up autopay"): set bonus_value, bonus_time, bonus_spending all to null. Describe it in bonus_comment only.
- If you cannot confidently determine foreign_fee from the text, use null — do not guess.

JSON schema to follow exactly:
{{
  "card_name": "string | null",
  "issuing_bank": "string | null",
  "rewards_type": "Cash | Point | Miles",
  "rewards": {{
    "everything": 0.01
  }},
  "rotating": {{}},
  "custom": {{}},
  "annual_fee": 0,
  "foreign_fee": "No | 3% | null",
  "bonus_value": null,
  "bonus_time": null,
  "bonus_spending": null,
  "bonus_comment": "string",
  "general_comment": "string | null"
}}

Notes:
- rewards values are decimals: {{"everything": 0.01, "dining": 0.03, "groceries": 0.06}}
- rotating example: {{"q1_2025": {{"groceries": 0.05, "drugstore": 0.05}}, "q2_2025": {{"gas_ev": 0.05}}}}
- custom example: {{"gas_ev": 0.03, "online_retail": 0.03, "dining": 0.03}}
- annual_fee is an INTEGER with no $ sign: 0, 95, 325, etc.
- bonus_value, bonus_time, bonus_spending are INTEGERS or null — no units, no $ sign
- bonus_comment is always a string, never null

--- SCRAPED TEXT ---
{text}
--- END ---
"""

def buildJSON(clean_text: str) -> dict:
    if not EXPO_PUBLIC_GEMINI_API_KEY:
        raise ValueError("EXPO_PUBLIC_GEMINI_API_KEY environment variable is not set.")

    client = genai.Client(api_key=EXPO_PUBLIC_GEMINI_API_KEY)

    # Trim to ~30,000 chars (main page + related pricing/terms pages)
    MAX_CHARS = 30000
    if len(clean_text) > MAX_CHARS:
        clean_text = clean_text[:MAX_CHARS]

    prompt = PROMPT_TEMPLATE.format(text=clean_text)

    # Retry up to 3 times on per-minute rate limits (not per-day)
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            break
        except ClientError as e:
            err_str = str(e)
            if "429" not in err_str:
                raise
            # Per-day quota hit — re-raise immediately, no point retrying
            if "PerDay" in err_str:
                raise
            # Per-minute limit — extract wait time and retry
            match = re.search(r"retry in ([\d.]+)s", str(e), re.IGNORECASE)
            wait = float(match.group(1)) + 2 if match else 65
            print(f"  Rate limited — waiting {wait:.0f}s before retry {attempt + 1}/3...")
            time.sleep(wait)
            if attempt == 2:
                raise

    raw = response.text.strip()

    # Strip markdown code fences if Gemini wraps in ```json ... ```
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.rsplit("```", 1)[0].strip()

    return json.loads(raw)
