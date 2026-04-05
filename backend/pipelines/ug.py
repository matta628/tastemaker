"""
Ultimate Guitar "My Tabs" HTML importer.

Usage:
    python -m backend.pipelines.ug --html data/ug_mytabs.html [--dry-run]

Saves page as HTML from ultimate-guitar.com/user/mytabs, then run this.
Each UG tab entry becomes one row in guitar_songs with status='want_to_learn'
(unless the song already exists — then it's skipped).
"""
import argparse
import logging
import re
from datetime import datetime, timezone, date, timedelta
from pathlib import Path
from uuid import uuid4

from bs4 import BeautifulSoup
from dotenv import load_dotenv

from backend.db.schema import get_connection

root = Path(__file__).parent.parent.parent
load_dotenv(root / ".env")
load_dotenv(root / ".env.secret")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Map UG tab type strings → our part enum
PART_MAP = {
    "chords":       "chords",
    "chord":        "chords",
    "tabs":         "tabs",
    "tab":          "tabs",
    "guitar tab":   "tabs",
    "guitar tabs":  "tabs",
    "guitar chords":"chords",
    "solo":         "solo",
    "guitar solo":  "solo",
    "bass":         None,   # out of scope for now
    "bass tab":     None,
    "drum":         None,
    "ukulele":      None,
}


def parse_part(raw: str) -> str | None:
    return PART_MAP.get(raw.lower().strip())


def parse_date(raw: str) -> date | None:
    if not raw:
        return None
    s = raw.strip()
    # Relative: "7 days ago", "1 day ago"
    m = re.match(r'(\d+)\s+day', s, re.IGNORECASE)
    if m:
        return date.today() - timedelta(days=int(m.group(1)))
    if s.lower() in ("today", "yesterday"):
        return date.today() - timedelta(days=0 if "today" in s.lower() else 1)
    for fmt in ("%b %d, %Y", "%d %b %Y", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def clean_title(raw: str) -> str:
    # Strip UG version suffixes: "(ver 5)", "(ver. 2)", "(version 3)"
    cleaned = re.sub(r'\s*\(ver\.?\s*\d+\)', '', raw, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*\(version\s*\d+\)', '', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def parse_html(path: Path) -> list[dict]:
    html = path.read_text(encoding="utf-8", errors="ignore")
    soup = BeautifulSoup(html, "lxml")

    # Find the header row to learn column order
    header_el = soup.find(class_=lambda c: c and "oRSaY" in c.split() and "_1Pxoe" in c.split())
    if not header_el:
        # Try just finding any element with both classes
        header_el = soup.select_one(".oRSaY._1Pxoe")

    columns = []
    if header_el:
        cols = header_el.find_all(recursive=False)
        if not cols:
            cols = header_el.find_all(["div", "span", "td", "th"])
        columns = [c.get_text(strip=True).lower() for c in cols]
        log.info(f"Header columns detected: {columns}")
    else:
        log.warning("Could not find header row — will guess column order")

    # Find all song rows (class contains oRSaY but NOT _1Pxoe)
    all_rows = soup.find_all(class_=lambda c: c and "oRSaY" in c.split())
    song_rows = [
        r for r in all_rows
        if "_1Pxoe" not in (r.get("class") or [])
    ]
    log.info(f"Found {len(song_rows)} song rows")

    if not song_rows:
        log.error("No rows found. Make sure the page fully loaded before saving.")
        return []

    # Peek at first row to understand structure
    first = song_rows[0]
    cells = first.find_all(recursive=False)
    if not cells:
        cells = first.find_all(["div", "span", "td", "a"])
    log.info(f"First row has {len(cells)} cells: {[c.get_text(strip=True)[:30] for c in cells]}")

    songs = []
    for row in song_rows:
        cells = row.find_all(recursive=False)
        if not cells:
            cells = row.find_all(["div", "span", "td", "a"])

        texts = [c.get_text(strip=True) for c in cells]
        if len(texts) < 2:
            continue

        # Try to map by column headers, fall back to position guessing
        def col(name, fallback_idx):
            if columns:
                for i, h in enumerate(columns):
                    if name in h and i < len(texts):
                        return texts[i]
            return texts[fallback_idx] if fallback_idx < len(texts) else ""

        song = {
            "title":  clean_title(col("song", 0) or col("name", 0)),
            "artist": col("artist", 1),
            "type":   col("type", 2),
            "date":   col("date", 3) or col("added", 3),
            "rating": col("rating", 4) or col("difficulty", 4),
        }

        # Skip rows that look empty or like ads/noise
        if not song["title"] or not song["artist"]:
            continue
        if len(song["title"]) > 150 or len(song["artist"]) > 100:
            continue

        songs.append(song)

    log.info(f"Parsed {len(songs)} valid entries")
    if songs:
        log.info(f"Sample: {songs[:3]}")
    return songs


def infer_difficulty(rating_str: str) -> int:
    """Map UG difficulty/rating string to 1-5 scale."""
    s = rating_str.strip().lower()
    if not s:
        return 3
    # UG uses: beginner, intermediate, advanced, expert
    if "beg" in s:    return 1
    if "inter" in s:  return 3
    if "adv" in s:    return 4
    if "expert" in s: return 5
    # Numeric rating out of 5
    try:
        v = float(s.replace(",", "."))
        return max(1, min(5, round(v)))
    except ValueError:
        pass
    return 3


def run(html_path: str, dry_run: bool = False):
    path = Path(html_path)
    if not path.exists():
        raise FileNotFoundError(f"HTML file not found: {path}")

    entries = parse_html(path)
    if not entries:
        log.error("Nothing to import.")
        return

    if dry_run:
        log.info("DRY RUN — not writing to DB")
        for e in entries[:10]:
            log.info(e)
        return

    conn = get_connection()
    inserted = skipped = 0
    now = datetime.now(tz=timezone.utc)

    for e in entries:
        part = parse_part(e["type"])
        # Skip bass/drums/ukulele
        if e["type"] and part is None and e["type"].lower().strip() not in ("", "-"):
            skipped += 1
            continue

        # Skip if exact title+artist+part combo already exists
        exists = conn.execute(
            "SELECT 1 FROM guitar_songs WHERE lower(title)=lower(?) AND lower(artist)=lower(?) AND part IS NOT DISTINCT FROM ?",
            [e["title"], e["artist"], part]
        ).fetchone()
        if exists:
            skipped += 1
            continue

        conn.execute("""
            INSERT INTO guitar_songs
                (song_id, title, artist, part, difficulty, status, notes, date_started, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, NULL, '', ?, ?, ?)
        """, [
            str(uuid4()),
            e["title"],
            e["artist"],
            part,
            parse_date(e["date"]) or date.today(),
            now,
            now,
        ])
        inserted += 1

    conn.close()
    log.info(f"Done. Inserted {inserted}, skipped {skipped} (already exist or non-guitar types).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", required=True, help="Path to saved UG mytabs HTML file")
    parser.add_argument("--dry-run", action="store_true", help="Parse only, don't write to DB")
    args = parser.parse_args()
    run(args.html, dry_run=args.dry_run)
