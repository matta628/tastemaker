"""
MusicBrainz artist enrichment pipeline.

Fetches structured artist metadata (type, country, formed year, genre tags) for
every distinct artist in the scrobble history. Uses the MusicBrainz search API
to resolve artist names to MBIDs, then fetches full artist records.

Usage:
    python -m backend.pipelines.musicbrainz
"""
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

from backend.db.schema import get_connection

root = Path(__file__).parent.parent.parent
load_dotenv(root / ".env")
load_dotenv(root / ".env.secret")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

MB_API_BASE = "https://musicbrainz.org/ws/2/"
# MusicBrainz requires a descriptive User-Agent with contact info
MB_HEADERS = {
    "User-Agent": "Tastemaker/1.0 (matta628@gmail.com)",
    "Accept": "application/json",
}
# 1.1s between requests — MusicBrainz policy is max 1 req/sec
REQUEST_INTERVAL = 1.1
# Only accept search results with this confidence or higher (0-100 scale)
MIN_SCORE = 85


def _get(session: requests.Session, path: str, params: dict, retries: int = 3) -> dict | None:
    url = MB_API_BASE + path
    for attempt in range(retries):
        try:
            resp = session.get(url, params=params, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 503:
                wait = 2.0 ** attempt
                log.warning(f"MB 503 — retrying in {wait:.1f}s (attempt {attempt+1}/{retries})")
                time.sleep(wait)
                continue
            if resp.status_code == 429:
                wait = 5.0 * (attempt + 1)
                log.warning(f"MB rate limited — retrying in {wait:.1f}s")
                time.sleep(wait)
                continue
            log.warning(f"MB {resp.status_code} for {path} {params}")
            return None
        except requests.RequestException as e:
            wait = 2.0 ** attempt
            log.warning(f"MB request error ({e}) — retrying in {wait:.1f}s")
            time.sleep(wait)
    return None


def search_artist(session: requests.Session, artist_name: str) -> dict | None:
    """
    Search MusicBrainz for an artist by name. Returns the best match if score >= MIN_SCORE.

    Returns a dict with: mb_artist_id, artist_type, country, formed_year, ended, tags
    """
    data = _get(session, "artist", {
        "query": f'artist:"{artist_name}"',
        "limit": 1,
        "fmt": "json",
    })
    if not data:
        return None

    artists = data.get("artists", [])
    if not artists:
        return None

    hit = artists[0]
    score = int(hit.get("score", 0))
    if score < MIN_SCORE:
        return None

    # Parse formed year from life-span begin date (format: YYYY, YYYY-MM, or YYYY-MM-DD)
    formed_year = None
    life_span = hit.get("life-span", {})
    begin = life_span.get("begin", "")
    if begin:
        try:
            formed_year = int(begin.split("-")[0])
        except (ValueError, IndexError):
            pass

    tags = [t["name"].lower() for t in hit.get("tags", []) if t.get("name")]

    return {
        "mb_artist_id": hit.get("id"),
        "artist_type":  hit.get("type"),           # 'Person', 'Group', 'Orchestra', etc.
        "country":      hit.get("country"),
        "formed_year":  formed_year,
        "ended":        bool(life_span.get("ended", False)),
        "tags":         tags,
    }


def _skip(conn, artist_name: str, reason: str):
    conn.execute("""
        INSERT INTO enrichment_skipped (entity_type, entity_name, reason)
        VALUES ('artist_mb', ?, ?)
        ON CONFLICT DO NOTHING
    """, (artist_name, reason))


def enrich_artist_mb(conn):
    """
    Fetch MusicBrainz metadata for all scrobble artists not yet enriched.
    Skips artists already in artist_mb or enrichment_skipped.
    """
    artists = [r[0] for r in conn.execute("""
        SELECT DISTINCT artist FROM raw_scrobbles
        WHERE artist NOT IN (SELECT artist_name FROM artist_mb)
          AND artist NOT IN (
              SELECT entity_name FROM enrichment_skipped
              WHERE entity_type = 'artist_mb'
          )
        ORDER BY artist
    """).fetchall()]

    log.info(f"[mb] Enriching {len(artists)} artists (~{len(artists) * REQUEST_INTERVAL / 60:.0f} min)")

    session = requests.Session()
    session.headers.update(MB_HEADERS)

    for i, artist in enumerate(artists):
        result = search_artist(session, artist)

        if result:
            conn.execute("""
                INSERT INTO artist_mb
                    (artist_name, mb_artist_id, artist_type, country, formed_year, ended, tags, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (artist_name) DO UPDATE SET
                    mb_artist_id = excluded.mb_artist_id,
                    artist_type  = excluded.artist_type,
                    country      = excluded.country,
                    formed_year  = excluded.formed_year,
                    ended        = excluded.ended,
                    tags         = excluded.tags,
                    fetched_at   = excluded.fetched_at
            """, (
                artist,
                result["mb_artist_id"],
                result["artist_type"],
                result["country"],
                result["formed_year"],
                result["ended"],
                result["tags"],
                datetime.now(tz=timezone.utc),
            ))
        else:
            _skip(conn, artist, "no_match")

        if (i + 1) % 50 == 0:
            log.info(f"[mb] {i + 1}/{len(artists)} done")

        time.sleep(REQUEST_INTERVAL)

    conn.execute("""
        INSERT INTO pipeline_state (pipeline_name, last_fetched_at)
        VALUES ('musicbrainz', ?)
        ON CONFLICT (pipeline_name) DO UPDATE SET last_fetched_at = excluded.last_fetched_at
    """, [datetime.now(tz=timezone.utc)])

    done = conn.execute("SELECT COUNT(*) FROM artist_mb").fetchone()[0]
    log.info(f"[mb] Done. artist_mb now has {done} rows.")


def run():
    conn = get_connection()
    enrich_artist_mb(conn)
    conn.close()


if __name__ == "__main__":
    run()
