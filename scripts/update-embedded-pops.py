#!/usr/bin/env python3
"""
Fetches the CloudFront Embedded PoPs PDF from AWS, extracts city/country
data, and writes a JSON file matching the schema of the edge locations dataset.

Exit codes:
  0 — changes detected, updated file written
  1 — error
  2 — no changes
"""

import json
import os
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

PDF_URL = "https://d1.awsstatic.com/onedam/marketing-channels/website/aws/en_US/product-categories/networking/approved/documents/cloudfront-embedded-PoPs.pdf"
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PATH = SCRIPT_DIR.parent / "public" / "static" / "cloudfront-embedded-pops.json"

COUNTRY_CODES = {
    "Argentina": "AR",
    "Brazil": "BR",
    "Canada": "CA",
    "Ecuador": "EC",
    "France": "FR",
    "Germany": "DE",
    "Great Britain": "GB",
    "India": "IN",
    "Island of Reunion": "RE",
    "Italy": "IT",
    "Japan": "JP",
    "Mexico": "MX",
    "Monaco": "MC",
    "New Zealand": "NZ",
    "Puerto Rico": "PR",
    "Thailand": "TH",
    "The Isle of Man": "IM",
    "United States": "US",
}


def fetch_pdf(url):
    """Download PDF to a temp file and return the path."""
    print(f"Fetching {url}…")
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    urllib.request.urlretrieve(url, tmp.name)
    print(f"Downloaded to {tmp.name}")
    return tmp.name


def extract_text(pdf_path):
    """Extract all text from a PDF using PyMuPDF."""
    import pymupdf

    doc = pymupdf.open(pdf_path)
    pages = []
    for page in doc:
        pages.append(page.get_text())
    return "\n".join(pages)


CITY_NORMALIZATIONS = {
    # Typos
    "Aukland": "Auckland",
    "Coimbtore": "Coimbatore",
    "Colombia": "Columbia",
    # Abbreviations
    "Settimo M.se": "Settimo Milanese",
    "Col. Nuevo Repueblo": "Monterrey",
    # Duplicate spellings → canonical form
    "Bhubaneshwar": "Bhubaneswar",
    "Ernakulum": "Ernakulam",
    "Firenze": "Florence",
    "Mérida": "Merida",
    "Padova": "Padua",
    "Venezia": "Venice",
    # India: states → nearest city (state)
    "Chandigarh": "Chandigarh (Haryana)",
    "Haryana": "Chandigarh (Haryana)",
    # UK: orphaned/duplicate → parent city
    "Keynes": "Milton Keynes",
    "Middlesex": "London",
    # UK: counties → nearest city (county)
    "Berkshire": "Slough (Berkshire)",
    "East Sussex": "Brighton (East Sussex)",
    "Guildford": "Guildford (Surrey)",
    "Hampshire": "Southampton (Hampshire)",
    "Kent": "Maidstone (Kent)",
    "Slough": "Slough (Berkshire)",
    "Surrey": "Guildford (Surrey)",
    # Japanese "City" variants
    "Fukuoka-City": "Fukuoka",
    "Fukuoka-shi": "Fukuoka",
    "Nagoya City": "Nagoya",
    "Nisshin City": "Nisshin",
}


def title_case(s):
    lower_words = {"de", "en", "da", "do", "dos", "das"}
    parts = re.split(r"(\s+|-)", s)
    result = []
    for i, part in enumerate(parts):
        if re.match(r"^\s+$", part) or part == "-":
            result.append(part)
        elif i > 0 and part.lower() in lower_words:
            result.append(part.lower())
        else:
            result.append(part[0].upper() + part[1:].lower() if len(part) > 1 else part.upper())
    return "".join(result)


def parse_locations(text):
    """
    Parse the PDF text into a list of { city, country, country_code } entries.
    The PDF format is:
      Country Name:
      City1
      City2
      ...
      Next Country:
      ...
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    locations = []
    current_country = None
    unmapped = set()

    for line in lines:
        if line.endswith(":"):
            candidate = line[:-1].strip()
            if candidate in COUNTRY_CODES:
                current_country = candidate
            else:
                unmapped.add(candidate)
                current_country = candidate
        elif current_country:
            city = line.strip('"').strip()
            if not city:
                continue
            if city == city.upper() and len(city) > 1:
                city = title_case(city)
            city = re.sub(r"\s+MCN$", "", city)
            if ", " in city:
                city = city.split(", ")[-1]
            city = CITY_NORMALIZATIONS.get(city, city)
            country_code = COUNTRY_CODES.get(current_country, "")
            locations.append({
                "city": city,
                "country": current_country,
                "country_code": country_code,
            })

    if unmapped - set(COUNTRY_CODES.keys()):
        missing = unmapped - set(COUNTRY_CODES.keys())
        print(f"⚠ Unmapped countries (add to COUNTRY_CODES): {', '.join(sorted(missing))}")

    seen = set()
    deduped = []
    for loc in locations:
        key = (loc["country"], loc["city"])
        if key not in seen:
            seen.add(key)
            deduped.append(loc)

    deduped.sort(key=lambda x: (x["country"], x["city"]))
    return deduped


def diff_locations(old_locs, new_locs):
    """Compute added/removed between old and new location lists."""
    old_set = {(l["country"], l["city"]) for l in old_locs}
    new_set = {(l["country"], l["city"]) for l in new_locs}

    added = sorted(new_set - old_set)
    removed = sorted(old_set - new_set)
    return added, removed


def format_summary(added, removed):
    """Format a human-readable diff summary."""
    lines = []
    if added:
        lines.append("### New embedded PoPs\n")
        for country, city in added:
            code = COUNTRY_CODES.get(country, "??")
            lines.append(f"- **{city}**, {country} ({code})")
        lines.append("")
    if removed:
        lines.append("### Removed embedded PoPs\n")
        for country, city in removed:
            code = COUNTRY_CODES.get(country, "??")
            lines.append(f"- **{city}**, {country} ({code})")
        lines.append("")
    return "\n".join(lines)


def output_for_github(name, value):
    """Write a value to $GITHUB_OUTPUT."""
    output_file = os.environ.get("GITHUB_OUTPUT")
    if not output_file:
        print(f"[output] {name}={value[:200]}…")
        return
    with open(output_file, "a") as f:
        if "\n" in value:
            import random
            import string
            delim = "EOF_" + "".join(random.choices(string.ascii_lowercase, k=8))
            f.write(f"{name}<<{delim}\n{value}\n{delim}\n")
        else:
            f.write(f"{name}={value}\n")


def main():
    pdf_path = fetch_pdf(PDF_URL)
    try:
        text = extract_text(pdf_path)
    finally:
        os.unlink(pdf_path)

    locations = parse_locations(text)
    print(f"Parsed {len(locations)} embedded PoP locations")

    committed = []
    if DATA_PATH.exists():
        committed = json.loads(DATA_PATH.read_text())
    else:
        print("No existing data file — treating as initial seed.")

    added, removed = diff_locations(committed, locations)
    total_changes = len(added) + len(removed)

    if total_changes == 0:
        print("No changes detected.")
        sys.exit(2)

    print(f"Changes: +{len(added)} added, -{len(removed)} removed")

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(locations, indent=2, ensure_ascii=False) + "\n")
    print(f"Updated {DATA_PATH}")

    title_parts = []
    if added:
        title_parts.append(f"{len(added)} added")
    if removed:
        title_parts.append(f"{len(removed)} removed")
    title = f"Update CloudFront embedded PoPs ({', '.join(title_parts)})"

    summary = format_summary(added, removed)
    output_for_github("title", title)
    output_for_github("summary", summary)
    print(f"\n{summary}")
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Fatal: {e}", file=sys.stderr)
        sys.exit(1)
