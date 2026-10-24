import os
from bs4 import BeautifulSoup

SCRAPER_DIR = os.path.dirname(os.path.abspath(__file__))

def cleanHTML(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    for tag in soup(["script", "style", "noscript", "svg", "img", "iframe", "link", "meta"]):
        tag.decompose()

    text = soup.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines()]
    clean = "\n".join(line for line in lines if line)

    return clean

def saveClean(text: str, output_filename="card_clean.txt"):
    output_path = os.path.join(SCRAPER_DIR, output_filename)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Saved to {output_path}")
