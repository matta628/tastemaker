"""
Agent tools — everything the agent can call to fetch data or take actions.
"""
import json
import time

import duckdb
import requests
import os
from langchain_core.tools import tool

from backend.db.schema import DB_PATH
from backend.playlist_service import build_shortcuts_url

LASTFM_API_BASE = "http://ws.audioscrobbler.com/2.0/"


@tool
def query_database(sql: str) -> str:
    """
    Run a read-only SQL query against the personal taste database (DuckDB).

    Tables available:
    - raw_scrobbles(track, artist, album, scrobbled_at, mbid)
    - raw_books(book_id, title, author, isbn, rating 0-5, date_read, shelf, ol_subjects[], ol_description)
    - guitar_songs(song_id, title, artist, part, difficulty 1-5, status, notes, date_started)
    - practice_log(log_id, song_id, practiced_at)
    - artists(artist_id, name), tracks(track_id, title, artist_id)
    - scrobbles(scrobble_id, track_id, artist_id, album_id, scrobbled_at)
    - taste_tags(tag_id, entity_type, entity_id, tag, source)
    - artist_tags(artist_name, tag, weight 0-100)         -- Last.fm genre/mood tags per artist
    - artist_similar(artist_name, similar_artist, similarity 0-1) -- taste graph
    - track_tags(track, artist, tag, weight 0-100)        -- per-track mood/season tags (5+ scrobbles only)

    Always query real data before making any recommendation.
    Keep queries focused — avoid SELECT * on large tables like raw_scrobbles.
    """
    try:
        conn = duckdb.connect(str(DB_PATH), read_only=True)
        result = conn.execute(sql).df()
        conn.close()
        if result.empty:
            return "Query returned no rows."
        return result.to_markdown(index=False)
    except Exception as e:
        return f"Query error: {e}"


@tool
def build_playlist(name: str, tracks: list[dict]) -> str:
    """
    Package a curated track list into a playlist the user can add to Apple Music.

    Args:
        name:   A short, evocative playlist name (e.g. "Autumn Pages", "Funk Friday")
        tracks: List of {"title": str, "artist": str} dicts, ordered as they should play.
                Aim for 15-25 tracks for a good playlist length unless the user specifies a count.
                Maximum 250 tracks.

    Returns:
        A JSON string with:
        - "shortcuts_url": open this URL on iPhone to trigger the Shortcuts playlist creator
        - "tracks": the formatted track list for display in the UI
        - "name": the playlist name

    When building a playlist:
    1. Query artist_tags / track_tags first to find personally-listened tracks matching the vibe
    2. Use artist_similar to expand beyond direct history if needed
    3. Order tracks thoughtfully — energy arc, not alphabetical

    For discovery requests ("new songs", "haven't heard", "fresh picks"):
    - Use artist_similar to find adjacent artists not in the user's scrobble history
    - Use track_similar_lookup on their favorite tracks to surface unfamiliar songs
    - Cross-reference raw_scrobbles to confirm a track hasn't been played (or has low play count)
    """
    tracks = tracks[:250]  # cap to prevent URL length issues with iOS Shortcuts
    url = build_shortcuts_url(name, tracks)
    return json.dumps({
        "name": name,
        "tracks": tracks,
        "shortcuts_url": url,
    })


@tool
def artist_top_tracks(artist: str, limit: int = 10) -> str:
    """
    Get an artist's most popular tracks ranked by Last.fm community plays.

    Use this to pick WHICH songs to include once you've chosen an artist —
    especially for discovery (new artists, unplayed songs from known artists).
    Prefer this over random selection or guessing track names.

    Args:
        artist: Artist name (exact or close match)
        limit:  Number of tracks to return (default 10, max 50)

    Returns:
        Markdown table of top tracks with play counts.

    Strategy guide:
    - For "new songs from artists I like": query raw_scrobbles to find their top artists,
      call this tool, then filter out tracks already in raw_scrobbles.
    - For "new artists": find via artist_similar, call this tool on each new artist.
    - Do NOT rely on track_tags for discovery — only 33% of tracks have them.
      Use artist_tags for genre/vibe matching, this tool for song selection.
    """
    api_key = os.getenv("LASTFM_API_KEY")
    if not api_key:
        return "LASTFM_API_KEY not set."
    try:
        resp = requests.get(LASTFM_API_BASE, params={
            "method": "artist.getTopTracks",
            "artist": artist,
            "limit": min(limit, 50),
            "api_key": api_key,
            "format": "json",
        }, timeout=10)
        tracks = resp.json().get("toptracks", {}).get("track", [])
        if not tracks:
            return f"No top tracks found for {artist}."
        rows = [{"title": t["name"], "artist": artist, "plays": int(t["playcount"])}
                for t in tracks]
        import pandas as pd
        return pd.DataFrame(rows).to_markdown(index=False)
    except Exception as e:
        return f"Error: {e}"


@tool
def track_similar_lookup(track: str, artist: str, limit: int = 10) -> str:
    """
    Find tracks similar to a given song via Last.fm.
    Use this during playlist building when you need discovery beyond the personal library.

    Args:
        track:  Song title
        artist: Artist name
        limit:  Number of similar tracks to return (default 10, max 50)

    Returns:
        Markdown table of similar tracks with match scores.
    """
    api_key = os.getenv("LASTFM_API_KEY")
    if not api_key:
        return "LASTFM_API_KEY not set."
    try:
        resp = requests.get(LASTFM_API_BASE, params={
            "method": "track.getSimilar",
            "track": track,
            "artist": artist,
            "limit": limit,
            "api_key": api_key,
            "format": "json",
        }, timeout=10)
        similar = resp.json().get("similartracks", {}).get("track", [])
        if not similar:
            return f"No similar tracks found for {artist} — {track}."
        rows = [{"artist": s["artist"]["name"], "title": s["name"], "match": round(float(s["match"]), 3)}
                for s in similar]
        import pandas as pd
        return pd.DataFrame(rows).to_markdown(index=False)
    except Exception as e:
        return f"Error: {e}"
