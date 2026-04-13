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


def enrich_artist_tags(conn, api_key: str):
    """Fetch Last.fm genre/mood tags for every unique artist in scrobble history."""
    artists = [r[0] for r in conn.execute("""
        SELECT DISTINCT artist FROM raw_scrobbles
        WHERE artist NOT IN (SELECT DISTINCT artist_name FROM artist_tags)
        ORDER BY artist
    """).fetchall()]

    log.info(f"[enrich] artist_tags: {len(artists)} artists to enrich")

    for i, artist in enumerate(artists):
        try:
            resp = requests.get(API_BASE, params={
                "method": "artist.getTopTags",
                "artist": artist,
                "api_key": api_key,
                "format": "json",
            }, timeout=10)
            tags = resp.json().get("toptags", {}).get("tag", [])
            rows = [
                (artist, t["name"].lower(), int(t["count"]))
                for t in tags
                if isinstance(t.get("count"), (int, str)) and int(t["count"]) >= 10
            ]
            for row in rows:
                conn.execute("""
                    INSERT INTO artist_tags (artist_name, tag, weight)
                    VALUES (?, ?, ?)
                    ON CONFLICT DO NOTHING
                """, row)
        except Exception as e:
            log.warning(f"[enrich] artist_tags failed for {artist!r}: {e}")

        if (i + 1) % 100 == 0:
            log.info(f"[enrich] artist_tags: {i + 1}/{len(artists)} done")
        time.sleep(0.2)  # 5 req/sec max

    log.info(f"[enrich] artist_tags: done")


def enrich_artist_similar(conn, api_key: str):
    """Fetch similar artists for every unique artist in scrobble history."""
    artists = [r[0] for r in conn.execute("""
        SELECT DISTINCT artist FROM raw_scrobbles
        WHERE artist NOT IN (SELECT DISTINCT artist_name FROM artist_similar)
        ORDER BY artist
    """).fetchall()]

    log.info(f"[enrich] artist_similar: {len(artists)} artists to enrich")

    for i, artist in enumerate(artists):
        try:
            resp = requests.get(API_BASE, params={
                "method": "artist.getSimilar",
                "artist": artist,
                "limit": 10,
                "api_key": api_key,
                "format": "json",
            }, timeout=10)
            similar = resp.json().get("similarartists", {}).get("artist", [])
            for s in similar:
                try:
                    conn.execute("""
                        INSERT INTO artist_similar (artist_name, similar_artist, similarity)
                        VALUES (?, ?, ?)
                        ON CONFLICT DO NOTHING
                    """, (artist, s["name"], float(s["match"])))
                except Exception:
                    pass
        except Exception as e:
            log.warning(f"[enrich] artist_similar failed for {artist!r}: {e}")

        if (i + 1) % 100 == 0:
            log.info(f"[enrich] artist_similar: {i + 1}/{len(artists)} done")
        time.sleep(0.2)

    log.info(f"[enrich] artist_similar: done")


def enrich_track_tags(conn, api_key: str):
    """Fetch Last.fm tags for tracks scrobbled 5+ times (the ones that matter)."""
    tracks = conn.execute("""
        SELECT track, artist FROM raw_scrobbles
        GROUP BY track, artist
        HAVING COUNT(*) >= 5
        AND (track, artist) NOT IN (
            SELECT DISTINCT track, artist FROM track_tags
        )
        ORDER BY COUNT(*) DESC
    """).fetchall()

    log.info(f"[enrich] track_tags: {len(tracks)} tracks to enrich")

    for i, (track, artist) in enumerate(tracks):
        try:
            resp = requests.get(API_BASE, params={
                "method": "track.getTopTags",
                "track": track,
                "artist": artist,
                "api_key": api_key,
                "format": "json",
            }, timeout=10)
            tags = resp.json().get("toptags", {}).get("tag", [])
            rows = [
                (track, artist, t["name"].lower(), int(t["count"]))
                for t in tags
                if isinstance(t.get("count"), (int, str)) and int(t["count"]) >= 10
            ]
            for row in rows:
                conn.execute("""
                    INSERT INTO track_tags (track, artist, tag, weight)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT DO NOTHING
                """, row)
        except Exception as e:
            log.warning(f"[enrich] track_tags failed for {track!r} / {artist!r}: {e}")

        if (i + 1) % 200 == 0:
            log.info(f"[enrich] track_tags: {i + 1}/{len(tracks)} done")
        time.sleep(0.2)

    log.info(f"[enrich] track_tags: done")


def enrich(api_key: str | None = None):
    """Run all enrichment passes. Safe to re-run — skips already-enriched entries."""
    if not api_key:
        api_key = os.getenv("LASTFM_API_KEY")
    if not api_key:
        raise ValueError("LASTFM_API_KEY must be set")

    conn = get_connection()
    enrich_artist_tags(conn, api_key)
    enrich_artist_similar(conn, api_key)
    enrich_track_tags(conn, api_key)
    # Record completion so the status endpoint knows when enrichment last ran
    conn.execute("""
        INSERT INTO pipeline_state (pipeline_name, last_fetched_at)
        VALUES ('lastfm_enrich', ?)
        ON CONFLICT (pipeline_name) DO UPDATE SET last_fetched_at = excluded.last_fetched_at
    """, [datetime.now(tz=timezone.utc)])
    conn.close()
    log.info("[enrich] All enrichment passes complete.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "enrich":
        enrich()
    else:
        run()
