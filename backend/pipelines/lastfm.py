"""
Last.fm scrobble ingestion pipeline.

Pulls full scrobble history on first run, then incremental on subsequent runs.
Tracks state in pipeline_state table.

Usage:
    python -m backend.pipelines.lastfm
"""
import os
import time
import logging
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

API_BASE = "http://ws.audioscrobbler.com/2.0/"
PAGE_SIZE = 200


def get_last_fetched(conn) -> int | None:
    """Return unix timestamp of last successful fetch, or None for full pull."""
    row = conn.execute(
        "SELECT last_fetched_at FROM pipeline_state WHERE pipeline_name = 'lastfm'"
    ).fetchone()
    if row and row[0]:
        return int(row[0].timestamp())
    return None


def set_last_fetched(conn, dt: datetime):
    conn.execute("""
        INSERT INTO pipeline_state (pipeline_name, last_fetched_at)
        VALUES ('lastfm', ?)
        ON CONFLICT (pipeline_name) DO UPDATE SET last_fetched_at = excluded.last_fetched_at
    """, [dt])


def fetch_page(api_key: str, username: str, page: int, from_ts: int | None) -> dict:
    params = {
        "method": "user.getrecenttracks",
        "user": username,
        "api_key": api_key,
        "format": "json",
        "limit": PAGE_SIZE,
        "page": page,
        "extended": 0,
    }
    if from_ts:
        params["from"] = from_ts

    for attempt in range(5):
        try:
            resp = requests.get(API_BASE, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.HTTPError as e:
            if resp.status_code >= 500 and attempt < 4:
                wait = 2 ** attempt
                log.warning(f"Server error on page {page}, retrying in {wait}s (attempt {attempt + 1}/5)")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("unreachable")


def parse_track(track: dict) -> dict | None:
    """Parse a Last.fm track dict into our schema. Returns None for now-playing."""
    # Skip now-playing pseudo-entry
    if track.get("@attr", {}).get("nowplaying"):
        return None

    date_info = track.get("date", {})
    if not date_info:
        return None

    return {
        "track": track.get("name", "").strip(),
        "artist": track.get("artist", {}).get("#text", "").strip(),
        "album": track.get("album", {}).get("#text", "").strip() or None,
        "scrobbled_at": datetime.fromtimestamp(int(date_info["uts"]), tz=timezone.utc),
        "mbid": track.get("mbid") or None,
    }


def upsert_scrobbles(conn, scrobbles: list[dict]):
    if not scrobbles:
        return 0
    before = conn.execute("SELECT COUNT(*) FROM raw_scrobbles").fetchone()[0]
    for s in scrobbles:
        conn.execute("""
            INSERT INTO raw_scrobbles (track, artist, album, scrobbled_at, mbid)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (artist, track, scrobbled_at) DO NOTHING
        """, [s["track"], s["artist"], s["album"], s["scrobbled_at"], s["mbid"]])
    after = conn.execute("SELECT COUNT(*) FROM raw_scrobbles").fetchone()[0]
    return after - before


def run():
    api_key = os.getenv("LASTFM_API_KEY")
    username = os.getenv("LASTFM_USERNAME")
    if not api_key or not username:
        raise ValueError("LASTFM_API_KEY and LASTFM_USERNAME must be set in .env")

    conn = get_connection()
    from_ts = get_last_fetched(conn)
    run_start = datetime.now(tz=timezone.utc)

    if from_ts:
        log.info(f"Incremental pull: fetching scrobbles since {datetime.fromtimestamp(from_ts, tz=timezone.utc)}")
    else:
        log.info("Full pull: fetching entire scrobble history (this may take a while)")

    page = 1
    total_pages = None
    total_fetched = 0
    total_inserted = 0

    while True:
        log.info(f"Fetching page {page}" + (f"/{total_pages}" if total_pages else ""))
        try:
            data = fetch_page(api_key, username, page, from_ts)
        except requests.HTTPError as e:
            log.error(f"HTTP error on page {page}: {e}")
            break

        recenttracks = data.get("recenttracks", {})
        attr = recenttracks.get("@attr", {})
        total_pages = int(attr.get("totalPages", 1))
        tracks = recenttracks.get("track", [])

        if isinstance(tracks, dict):
            tracks = [tracks]  # single track edge case

        scrobbles = [p for t in tracks if (p := parse_track(t)) is not None]
        total_fetched += len(scrobbles)
        total_inserted += upsert_scrobbles(conn, scrobbles)

        if page >= total_pages:
            break

        page += 1
        time.sleep(0.25)  # be a good citizen — Last.fm rate limit is 5 req/sec

    set_last_fetched(conn, run_start)
    conn.close()

    log.info(f"Done. Fetched {total_fetched} scrobbles, inserted {total_inserted} new.")


if __name__ == "__main__":
    run()
