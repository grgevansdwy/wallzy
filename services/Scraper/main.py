import json
import os
import time
import random
from urllib.parse import urlparse
from extractHTML import createBrowser, closeBrowser, scrapeURL, findFeesLink
from htmlCleaner import cleanHTML, saveClean
from jsonBuilder import buildJSON

SCRAPER_DIR = os.path.dirname(os.path.abspath(__file__))
RESOURCE_FILE = os.path.join(SCRAPER_DIR, "resource.json")
OUTPUT_FILE = os.path.join(SCRAPER_DIR, "card.json")

# Load all cards: {card_id: {name, url}}
with open(RESOURCE_FILE, "r") as f:
    cards = json.load(f)

total = len(cards)
print(f"Found {total} cards to process.\n")

# Load existing results (keyed by card_id) so we can resume if interrupted
if os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, "r") as f:
        results = json.load(f)
    print(f"Resuming — {len(results)} already done.\n")
else:
    results = {}

# Filter out already-processed cards — retry nulls (failed last time)
remaining = {cid: info for cid, info in cards.items() if results.get(cid) is None}
print(f"{len(remaining)} card(s) to scrape.\n")

if not remaining:
    print("All cards already processed.")
else:
    p, browser, context = createBrowser()
    last_domain = None
    try:
        for i, (card_id, info) in enumerate(remaining.items(), 1):
            card_name = info["name"]
            url = info["url"]
            domain = urlparse(url).netloc

            # Add a longer cooldown when hitting the same domain back-to-back
            if last_domain is not None:
                if domain == last_domain:
                    wait = random.uniform(12, 20)
                    print(f"  Same domain — cooling down {wait:.0f}s...")
                    time.sleep(wait)
                else:
                    time.sleep(random.uniform(2, 4))

            print(f"[{i}/{len(remaining)}] {card_id} — {card_name}")
            print(f"  Scraping: {url}")

            html = scrapeURL(context, url)
            last_domain = domain

            if not html:
                print(f"  Scrape failed — saving null\n")
                results[card_id] = None
            else:
                clean = cleanHTML(html)

                # Scrape the best rates/fees page for foreign transaction fee info
                fees_url = findFeesLink(html, url)
                if fees_url:
                    print(f"  Fees page: {fees_url}")
                    # Extra pause before fees page on same domain
                    time.sleep(random.uniform(8, 14))
                    fees_html = scrapeURL(context, fees_url)
                    if fees_html:
                        combined = clean + "\n\n=== RATES / FEES ===\n\n" + cleanHTML(fees_html)[:8000]
                    else:
                        combined = clean
                else:
                    combined = clean

                saveClean(combined, "card_clean.txt")

                try:
                    data = buildJSON(combined)
                    results[card_id] = data
                    print(f"  Done. ({len(results)}/{total} total)\n")
                except Exception as e:
                    print(f"  Failed: {e} — saving null\n")
                    results[card_id] = None

            # Save progress after every card so we can resume on crash
            with open(OUTPUT_FILE, "w") as f:
                json.dump(results, f, indent=2)

    finally:
        closeBrowser(p, browser)

print(f"\nFinished. {len(results)}/{total} cards saved to card.json")
