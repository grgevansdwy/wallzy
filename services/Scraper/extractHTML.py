import os
import time
import random
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, BrowserContext

# High-value URL path fragments (fee/rates pages)
FEES_URL_KEYWORDS = ["rates-and-fees", "fees-and-rates", "pricing-terms", "pricing-and-terms", "rates", "fees", "apr", "disclosure", "disclosures"]
# High-value anchor text (what the link says)
FEES_ANCHOR_KEYWORDS = ["rates & fees", "rates and fees", "see rates", "view rates", "pricing & terms", "pricing and terms", "view terms", "terms and conditions", "rates, fees"]
SKIP_EXTENSIONS = (".pdf", ".png", ".jpg", ".jpeg", ".gif", ".zip", ".doc", ".docx")

SCRAPER_DIR = os.path.dirname(os.path.abspath(__file__))

def random_delay(min_s=1.5, max_s=3.5):
    time.sleep(random.uniform(min_s, max_s))

def human_browse(page):
    """Simulate human-like browsing: random mouse moves + gradual scrolling."""
    vw, vh = 1440, 900

    # Move mouse to a few random positions before touching the page
    for _ in range(random.randint(3, 6)):
        page.mouse.move(
            random.randint(100, vw - 100),
            random.randint(100, vh - 100),
        )
        random_delay(0.3, 0.8)

    # Gradual scroll down in small steps, with occasional pause
    total_scrolled = 0
    while total_scrolled < 4000:
        step = random.randint(200, 500)
        page.mouse.wheel(0, step)
        total_scrolled += step
        random_delay(0.4, 1.0)
        # Occasionally move the mouse mid-scroll
        if random.random() < 0.4:
            page.mouse.move(
                random.randint(200, vw - 200),
                random.randint(100, vh - 100),
            )

    # Pause at the bottom, then scroll back up a bit (humans rarely end at the bottom)
    random_delay(1.5, 3.0)
    page.mouse.wheel(0, -random.randint(300, 800))
    random_delay(0.8, 1.5)

def createBrowser():
    """Launch a browser and return (playwright, browser, context). Call closeBrowser() when done."""
    p = sync_playwright().start()
    browser = p.firefox.launch(
        headless=False,
        slow_mo=50,
    )
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) "
            "Gecko/20100101 Firefox/133.0"
        ),
        locale="en-US",
        timezone_id="America/New_York",
        java_script_enabled=True,
        extra_http_headers={
            "Accept-Language": "en-US,en;q=0.5",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        },
    )
    return p, browser, context

def closeBrowser(p, browser):
    browser.close()
    p.stop()

def scrapeURL(context: BrowserContext, url: str) -> str:
    """Scrape a single URL using an existing browser context."""
    page = context.new_page()
    try:
        # Try networkidle first (waits for JS to finish); fall back on timeout
        try:
            page.goto(url, wait_until="networkidle", timeout=90000)
        except Exception:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # Initial pause — let the page fully settle before touching anything
        random_delay(3.5, 6.0)

        human_browse(page)

        random_delay(1.5, 3.0)
        html = page.content()
    except Exception as e:
        print(f"  Error scraping {url}: {e}")
        html = None
    finally:
        page.close()
    return html

def findFeesLink(html: str, base_url: str) -> "str | None":
    """Find the single best rates/fees/terms page linked from this card page."""
    soup = BeautifulSoup(html, "html.parser")
    base_domain = urlparse(base_url).netloc
    best_url = None
    best_score = 0

    # For AmEx: fees page is predictable — try constructing it directly
    parsed = urlparse(base_url)
    if "americanexpress.com" in parsed.netloc:
        amex_fees_url = base_url.rstrip("/") + "/rates-and-fees/"
        return amex_fees_url

    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if not href or href.startswith("javascript") or href.startswith("mailto"):
            continue
        full_url = urljoin(base_url, href).split("#")[0]
        if any(full_url.lower().endswith(ext) for ext in SKIP_EXTENSIONS):
            continue
        if urlparse(full_url).netloc != base_domain:
            continue
        if full_url == base_url:
            continue

        url_path = urlparse(full_url).path.lower()
        text_lower = a.get_text(strip=True).lower()
        score = 0

        if any(kw in url_path for kw in FEES_URL_KEYWORDS):
            score += 2
        if any(kw in text_lower for kw in FEES_ANCHOR_KEYWORDS):
            score += 3

        if score > best_score:
            best_score = score
            best_url = full_url

    return best_url if best_score > 0 else None


def extractHTML(url: str) -> str:
    """Convenience wrapper for scraping a single URL (opens/closes browser automatically)."""
    p, browser, context = createBrowser()
    try:
        html = scrapeURL(context, url)
    finally:
        closeBrowser(p, browser)
    return html
