# Wallzy Card Scraper

Scrapes credit card product pages, extracts structured data via Gemini AI, and outputs `card.json`.

---

## How It Works

```
resource.json  →  extractHTML.py  →  htmlCleaner.py  →  jsonBuilder.py  →  card.json
   (URLs)           (Playwright)       (BeautifulSoup)     (Gemini AI)
```

1. `main.py` loads card names + URLs from `resource.json`
2. For each card, Playwright scrapes the main page
3. `findFeesLink()` finds the best rates/fees page and scrapes it too (for foreign transaction fee)
4. `cleanHTML()` strips scripts/styles, extracts plain text
5. `buildJSON()` sends the text to Gemini (`gemini-2.5-flash`) with a structured prompt
6. Results are saved to `card.json` after every card (auto-resume on crash)

---

## Running

```bash
python3 main.py
```

If interrupted, just run again — it skips already-processed cards and retries nulls.

---

## card.json Schema

```json
{
  "card_name": "string",
  "issuing_bank": "string",
  "rewards_type": "cashback | miles | points",
  "rewards": {
    "everything": 0.01,
    "dining": 0.03
  },
  "rotating": {
    "q1_2025": { "groceries": 0.05, "drugstore": 0.05 }
  },
  "custom": {
    "gas_ev": 0.03,
    "dining": 0.03
  },
  "annual_fee": 0,
  "foreign_fee": "No | 3% | null",
  "bonus_value": 200,
  "bonus_time": 3,
  "bonus_spending": 2000,
  "bonus_comment": "string",
  "general_comment": "string"
}
```

- All reward rates are **decimals**: `0.01` = 1%, `0.03` = 3%, `1.0` = 1x points/miles
- `annual_fee` is an **integer** with no `$` sign: `0`, `95`, `325`
- `bonus_value`, `bonus_time`, `bonus_spending` are **integers with no units** (`200` = $200, `3` = 3 months, `2000` = $2000)
- `bonus_comment` is always a string (never null) — describes the bonus or says "No welcome bonus for this card."
- `everything` is the catch-all base rate key (replaces `base`)
- Standard category keys: `everything`, `groceries`, `dining`, `gas_ev`, `streaming_subscription`, `online_retail`, `entertainment`, `wholesale`, `restaurant`, `travel`, `flight`, `hotel`, `transit`, `drugstore`, `home_furnishing`, `fitness_club`, `cell_phone`, `electronic_store`, `fast_food`, `home_utilities`, `car_rental`, `apple_pay`

---

## ⚠️ Hardcoded Values

The following `foreign_fee` values **could not be extracted by the scraper** (the fee tables on these sites require JavaScript interactions or are not present in the scraped HTML). They were manually hardcoded in `card.json` based on verified issuer disclosures.

| Card | foreign_fee | Source |
|---|---|---|
| Amex Blue Cash Everyday Card | `2.7%` | americanexpress.com rates page |
| Amex Blue Cash Preferred Card | `2.7%` | americanexpress.com rates page |
| American Express Gold Card | `No` | americanexpress.com rates page |
| Chase Freedom Flex® | `3%` | creditcards.chase.com pricing & terms |
| Chase Freedom Unlimited® | `3%` | creditcards.chase.com pricing & terms |
| Chase Freedom Rise Card | `3%` | creditcards.chase.com pricing & terms |
| Prime Visa | `3%` | amazon.com/chase card agreement |
| Discover it Student Chrome | `No` | discover.com rates & fees |
| Discover it Miles | `No` | discover.com rates & fees |
| Discover it® Secured | `No` | discover.com rates & fees |
| Wells Fargo Active Cash Card | `3%` | wellsfargo.com card agreement |
| Wells Fargo Reflect Card | `3%` | wellsfargo.com card agreement |
| U.S. Bank Altitude Go Visa Signature® Card | `No` | usbank.com rates & fees |
| U.S. Bank Smartly Visa Signature Card | `No` | usbank.com rates & fees |
| PayPal Cashback Mastercard | `No` | paypal.com card agreement |
| OpenSky® Plus Secured Visa® | `3%` | openskycc.com card agreement |

> If any of these cards update their fee structure, you must manually update both `card.json`
> and this table. The scraper will not overwrite existing non-null values on re-runs.

---

## Troubleshooting

**Gemini quota error (`429 PerDay`)**
The free tier allows ~20 requests/day on `gemini-2.5-flash`. Make sure your project in
[AI Studio](https://aistudio.google.com) is on **Paid Tier 1** (10K RPD).

**Card saves as null**
Either the site blocked the scraper or Gemini returned invalid JSON. Just re-run — the script
automatically retries all null entries.

**`ERR_HTTP_RESPONSE_CODE_FAILURE`**
The site is actively blocking Playwright. The card will remain null.
