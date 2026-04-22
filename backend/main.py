"""
FastAPI application — Guitar song CRUD + practice logging + agent chat.
"""
from datetime import date, datetime, timezone
from typing import Literal
from uuid import uuid4

import asyncio
import json
import os
import time
import urllib.parse
import duckdb
import requests
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pathlib import Path
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv(".env.secret")

LYRICS_CACHE = Path("lyrics_cache.json")
LYRICS_CACHE_MAX_AGE_DAYS = 30  # invalidated by sync, not by age

from backend.db.schema import DB_PATH, create_schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_schema()
    asyncio.create_task(_lyrics_background_fetch())
    yield


app = FastAPI(title="Tastemaker API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://100.116.200.117:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Status = Literal["want_to_learn", "learning", "learned", "abandoned"]
Part = Literal["chords", "tabs", "solo"]

# ── Pipeline run-state (in-process flags) ─────────────────────────────────
_enrich_running: bool = False
_enrich_last_error: str | None = None
_sync_running: bool = False
_goodreads_running: bool = False
_goodreads_last_error: str | None = None
_guitar_running: bool = False
_guitar_last_error: str | None = None
_mb_running: bool = False
_mb_last_error: str | None = None


def db():
    return duckdb.connect(str(DB_PATH))


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

class SongCreate(BaseModel):
    title: str
    artist: str
    part: Part | None = None
    difficulty: int = Field(..., ge=1, le=5)   # required in form
    status: Status = "want_to_learn"            # required in form
    notes: str = ""
    date_started: date = Field(default_factory=date.today)


class SongUpdate(BaseModel):
    title: str | None = None
    artist: str | None = None
    part: Part | None = None
    difficulty: int | None = Field(None, ge=1, le=5)
    status: Status | None = None
    notes: str | None = None
    date_started: date | None = None


class Song(BaseModel):
    song_id: str
    title: str
    artist: str
    part: Part | None
    difficulty: int | None       # None = imported, not yet validated
    status: Status | None        # None = imported, not yet validated
    notes: str | None
    date_started: date | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/songs", response_model=list[Song])
def list_songs(status: Status | None = None):
    conn = db()
    if status:
        rows = conn.execute(
            "SELECT * FROM guitar_songs WHERE status = ? ORDER BY updated_at DESC",
            [status]
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM guitar_songs ORDER BY updated_at DESC"
        ).fetchall()
    conn.close()
    cols = ["song_id", "title", "artist", "part", "difficulty", "status",
            "notes", "date_started", "created_at", "updated_at"]
    return [Song(**dict(zip(cols, r))) for r in rows]


@app.post("/songs", response_model=Song, status_code=201)
def add_song(body: SongCreate):
    song_id = str(uuid4())
    now = datetime.now(tz=timezone.utc)
    conn = db()
    conn.execute("""
        INSERT INTO guitar_songs
            (song_id, title, artist, part, difficulty, status, notes, date_started, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [song_id, body.title, body.artist, body.part, body.difficulty,
          body.status, body.notes, body.date_started, now, now])
    conn.close()
    return Song(song_id=song_id, **body.model_dump(), created_at=now, updated_at=now)


@app.put("/songs/{song_id}", response_model=Song)
def update_song(song_id: str, body: SongUpdate):
    conn = db()
    row = conn.execute(
        "SELECT * FROM guitar_songs WHERE song_id = ?", [song_id]
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Song not found")

    cols = ["song_id", "title", "artist", "part", "difficulty", "status",
            "notes", "date_started", "created_at", "updated_at"]
    current = dict(zip(cols, row))
    updates = body.model_dump(exclude_none=True)
    current.update(updates)
    now = datetime.now(tz=timezone.utc)
    current["updated_at"] = now

    conn.execute("""
        UPDATE guitar_songs
        SET title=?, artist=?, part=?, difficulty=?, status=?, notes=?, date_started=?, updated_at=?
        WHERE song_id=?
    """, [current["title"], current["artist"], current["part"], current["difficulty"],
          current["status"], current["notes"], current["date_started"], now, song_id])
    conn.close()
    return Song(**current)


@app.delete("/songs/{song_id}", status_code=204)
def delete_song(song_id: str):
    conn = db()
    result = conn.execute(
        "DELETE FROM guitar_songs WHERE song_id = ?", [song_id]
    )
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Song not found")


@app.post("/songs/{song_id}/practice", status_code=201)
def log_practice(song_id: str):
    conn = db()
    row = conn.execute(
        "SELECT song_id FROM guitar_songs WHERE song_id = ?", [song_id]
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Song not found")

    log_id = str(uuid4())
    now = datetime.now(tz=timezone.utc)
    conn.execute(
        "INSERT INTO practice_log (log_id, song_id, practiced_at) VALUES (?, ?, ?)",
        [log_id, song_id, now]
    )
    conn.execute(
        "UPDATE guitar_songs SET updated_at = ? WHERE song_id = ?", [now, song_id]
    )
    conn.close()
    return {"log_id": log_id, "song_id": song_id, "practiced_at": now}


@app.delete("/practice/{log_id}", status_code=204)
def delete_practice(log_id: str):
    conn = db()
    result = conn.execute("DELETE FROM practice_log WHERE log_id = ?", [log_id])
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Log entry not found")


@app.get("/songs/{song_id}/practice")
def get_practice_log(song_id: str):
    conn = db()
    rows = conn.execute(
        "SELECT log_id, practiced_at FROM practice_log WHERE song_id = ? ORDER BY practiced_at DESC LIMIT 10",
        [song_id]
    ).fetchall()
    conn.close()
    return [{"log_id": r[0], "practiced_at": r[1]} for r in rows]


# ---------------------------------------------------------------------------
# Taste
# ---------------------------------------------------------------------------

@app.get("/taste/top-artists")
def top_artists(days: int = 30, limit: int = 10):
    conn = db()
    rows = conn.execute("""
        SELECT artist, COUNT(*) as plays
        FROM raw_scrobbles
        WHERE scrobbled_at >= now() - INTERVAL (? || ' days')
        GROUP BY artist
        ORDER BY plays DESC
        LIMIT ?
    """, [days, limit]).fetchall()
    conn.close()
    return [{"artist": r[0], "plays": r[1]} for r in rows]


@app.get("/taste/top-tracks")
def top_tracks(days: int = 30, limit: int = 20):
    conn = db()
    rows = conn.execute("""
        SELECT track, artist, COUNT(*) as plays
        FROM raw_scrobbles
        WHERE scrobbled_at >= now() - INTERVAL (? || ' days')
        GROUP BY track, artist
        ORDER BY plays DESC
        LIMIT ?
    """, [days, limit]).fetchall()
    conn.close()
    return [{"track": r[0], "artist": r[1], "plays": r[2]} for r in rows]


def _genius_top_fragment(track: str, artist: str, token: str) -> str | None:
    """Get the most-upvoted annotated lyric fragment for a song via Genius API."""
    try:
        headers = {"Authorization": f"Bearer {token}"}

        # Step 1: search for the song to get its ID
        res = requests.get(
            "https://api.genius.com/search",
            headers=headers,
            params={"q": f"{track} {artist}"},
            timeout=5,
        )
        hits = res.json().get("response", {}).get("hits", [])
        if not hits:
            return None
        song_id = hits[0]["result"]["id"]

        # Step 2: get all annotated fragments for the song
        res = requests.get(
            "https://api.genius.com/referents",
            headers=headers,
            params={"song_id": song_id, "text_format": "plain", "per_page": 50},
            timeout=5,
        )
        referents = res.json().get("response", {}).get("referents", [])
        if not referents:
            return None

        # Score each fragment by its top annotation's vote count
        candidates = []
        for ref in referents:
            fragment = ref.get("fragment", "").strip()
            annotations = ref.get("annotations", [])
            if not fragment or not annotations:
                continue
            votes = max(a.get("votes_total", 0) for a in annotations)
            word_count = len(fragment.split())
            char_count = len(fragment)
            # Skip non-lyric fragments: too short/long, ratings (x/10), or URLs
            if not (3 <= word_count <= 30 and char_count <= 200):
                continue
            if any(x in fragment for x in ["http", "/10", "/5", "10/10", "@"]):
                continue
            candidates.append((votes, fragment))

        if not candidates:
            return None

        # Return the fragment with the most upvoted annotation
        candidates.sort(key=lambda x: x[0], reverse=True)
        return candidates[0][1]

    except Exception:
        return None


def _lyrics_ovh_snippet(track: str, artist: str) -> str | None:
    """Fallback: fetch a lyric snippet from lyrics.ovh (free, no key needed)."""
    try:
        res = requests.get(
            f"https://api.lyrics.ovh/v1/{urllib.parse.quote(artist)}/{urllib.parse.quote(track)}",
            timeout=8,
        )
        if res.status_code != 200:
            return None
        lyrics = res.json().get("lyrics", "")
        lines = [l.strip() for l in lyrics.splitlines() if l.strip()]
        if len(lines) < 2:
            return None
        start = max(0, len(lines) // 3)
        return " / ".join(lines[start:start + 3])
    except Exception:
        return None


def _lyrics_snippet(track: str, artist: str) -> str | None:
    """Try Genius top-annotated fragment first, fall back to lyrics.ovh."""
    token = os.environ.get("GENIUS_ACCESS_TOKEN")
    if token:
        fragment = _genius_top_fragment(track, artist, token)
        if fragment:
            return fragment
    return _lyrics_ovh_snippet(track, artist)


async def _lyrics_background_fetch():
    """On startup: fetch lyric snippets for top 100 tracks (last 30 days) via lyrics.ovh, cache to disk.
    Skips if cache is fresh. Rate-limited to 1 request per second."""
    if LYRICS_CACHE.exists() and LYRICS_CACHE.stat().st_size > 10:
        age_days = (time.time() - LYRICS_CACHE.stat().st_mtime) / 86400
        if age_days < LYRICS_CACHE_MAX_AGE_DAYS:
            cached = json.loads(LYRICS_CACHE.read_text())
            print(f"[lyrics] Cache fresh ({age_days:.1f}d old, {len(cached)} tracks) — skipping")
            return

    await asyncio.sleep(5)
    print("[lyrics] Starting lyrics fetch for top 100 tracks (last 30 days)…")

    try:
        conn = duckdb.connect(str(DB_PATH), read_only=True)
        rows = conn.execute("""
            SELECT track, artist, COUNT(*) as plays
            FROM raw_scrobbles
            WHERE scrobbled_at >= now() - INTERVAL '30 days'
            GROUP BY track, artist
            ORDER BY plays DESC
            LIMIT 100
        """).fetchall()
        conn.close()
        print(f"[lyrics] {len(rows)} tracks to look up")
    except Exception as e:
        print(f"[lyrics] DB query failed: {e}")
        return

    results = []
    for i, (track, artist, plays) in enumerate(rows):
        snippet = await asyncio.to_thread(_lyrics_snippet, track, artist)
        if snippet:
            results.append({"track": track, "artist": artist, "plays": plays, "snippet": snippet})
            print(f"[lyrics] ({i+1}/{len(rows)}) ✓ {artist} — {track}")
        else:
            print(f"[lyrics] ({i+1}/{len(rows)}) ✗ {artist} — {track}")
        await asyncio.sleep(1)

    LYRICS_CACHE.write_text(json.dumps(results))
    print(f"[lyrics] Done — {len(results)}/{len(rows)} with snippets")


@app.get("/taste/lyrics-snippets")
def lyrics_snippets():
    """Return cached Genius lyric snippets. Cache is populated in background on startup."""
    if LYRICS_CACHE.exists():
        return json.loads(LYRICS_CACHE.read_text())
    return []


# ---------------------------------------------------------------------------
# Pipelines
# ---------------------------------------------------------------------------

@app.get("/pipelines/status")
def pipelines_status():
    """Return last sync time, staleness, and enrichment progress."""
    conn = db()

    # Sync state timestamps
    rows = conn.execute("SELECT pipeline_name, last_fetched_at FROM pipeline_state").fetchall()
    state = {r[0]: r[1] for r in rows}
    now = datetime.now(tz=timezone.utc)

    def sync_entry(name):
        ts = state.get(name)
        if ts is None:
            return {"last_fetched_at": None, "days_ago": None, "stale": True}
        days = (now - ts).total_seconds() / 86400
        return {"last_fetched_at": ts.isoformat(), "days_ago": round(days, 1), "stale": days > 7}

    # Enrichment progress counts
    total_artists = conn.execute("SELECT COUNT(DISTINCT artist) FROM raw_scrobbles").fetchone()[0]
    total_tracks  = conn.execute("""
        SELECT COUNT(*) FROM (
            SELECT track, artist FROM raw_scrobbles
            GROUP BY track, artist HAVING COUNT(*) >= 2
        )
    """).fetchone()[0]

    done_artist_tags    = conn.execute("SELECT COUNT(DISTINCT artist_name) FROM artist_tags").fetchone()[0]
    done_artist_similar = conn.execute("SELECT COUNT(DISTINCT artist_name) FROM artist_similar").fetchone()[0]
    done_track_tags     = conn.execute("SELECT COUNT(DISTINCT track || artist) FROM track_tags").fetchone()[0]
    done_context_tags   = conn.execute("SELECT COUNT(DISTINCT track || artist) FROM track_context_tags").fetchone()[0]
    done_mb             = conn.execute("SELECT COUNT(*) FROM artist_mb").fetchone()[0]

    # Goodreads book count
    total_books = conn.execute("SELECT COUNT(*) FROM raw_books").fetchone()[0]

    # Guitar songs count
    total_guitar = conn.execute("SELECT COUNT(*) FROM guitar_songs").fetchone()[0]

    conn.close()

    def pct(done, total):
        return round(done / total * 100, 1) if total else 0

    return {
        "lastfm": {**sync_entry("lastfm"), "process_running": _sync_running},
        "enrichment": {
            **sync_entry("lastfm_enrich"),
            "process_running": _enrich_running,
            "last_error":      _enrich_last_error,
            "artist_tags":    {"done": done_artist_tags,    "total": total_artists, "pct": pct(done_artist_tags,    total_artists)},
            "artist_similar": {"done": done_artist_similar, "total": total_artists, "pct": pct(done_artist_similar, total_artists)},
            "track_tags":     {"done": done_track_tags,     "total": total_tracks,  "pct": pct(done_track_tags,     total_tracks)},
            "context_tags":   {"done": done_context_tags,   "total": total_tracks},
        },
        "musicbrainz": {
            **sync_entry("musicbrainz"),
            "process_running": _mb_running,
            "last_error":      _mb_last_error,
            "artist_count":    {"done": done_mb, "total": total_artists, "pct": pct(done_mb, total_artists)},
        },
        "goodreads": {
            **sync_entry("goodreads"),
            "process_running": _goodreads_running,
            "last_error":      _goodreads_last_error,
            "book_count":      total_books,
        },
        "guitar_import": {
            **sync_entry("guitar_import"),
            "process_running": _guitar_running,
            "last_error":      _guitar_last_error,
            "song_count":      total_guitar,
        },
    }


@app.post("/pipelines/lastfm/sync", status_code=202)
async def trigger_lastfm_sync():
    """Kick off a Last.fm sync in the background. Returns immediately."""
    global _sync_running
    if _sync_running:
        return {"status": "already_running"}

    async def run():
        global _sync_running
        _sync_running = True
        try:
            import subprocess
            result = await asyncio.to_thread(
                subprocess.run,
                ["python", "-m", "backend.pipelines.lastfm"],
                capture_output=True, text=True
            )
            print("[lastfm] sync done:", result.stdout[-500:] if result.stdout else result.stderr[-500:])
            # Invalidate lyrics cache so it rebuilds with fresh scrobble data
            if LYRICS_CACHE.exists():
                LYRICS_CACHE.unlink()
                print("[lyrics] Cache invalidated after sync — rebuilding in background")
                asyncio.create_task(_lyrics_background_fetch())
        finally:
            _sync_running = False

    asyncio.create_task(run())
    return {"status": "syncing"}


@app.post("/pipelines/lastfm/enrich", status_code=202)
async def trigger_lastfm_enrich():
    """Kick off enrichment. Rejects if already running to prevent stacked processes."""
    global _enrich_running, _enrich_last_error
    if _enrich_running:
        return {"status": "already_running"}

    async def run():
        global _enrich_running, _enrich_last_error
        _enrich_running = True
        _enrich_last_error = None
        try:
            import subprocess
            result = await asyncio.to_thread(
                subprocess.run,
                ["python", "-m", "backend.pipelines.lastfm", "enrich"],
                capture_output=True, text=True
            )
            tail = (result.stdout or result.stderr or "")[-800:]
            if result.returncode != 0:
                _enrich_last_error = f"Exit {result.returncode}: {(result.stderr or result.stdout or 'no output')[-400:]}"
                print(f"[lastfm] enrich FAILED (exit {result.returncode}):", tail)
            else:
                print("[lastfm] enrich done:", tail)
        except Exception as e:
            _enrich_last_error = str(e)
            print(f"[lastfm] enrich exception: {e}")
        finally:
            _enrich_running = False

    asyncio.create_task(run())
    return {"status": "enriching"}


@app.post("/pipelines/goodreads/upload", status_code=202)
async def upload_goodreads(file: UploadFile = File(...)):
    """Accept a Goodreads CSV export, save it, and run the import pipeline."""
    global _goodreads_running, _goodreads_last_error
    if _goodreads_running:
        return {"status": "already_running"}

    contents = await file.read()

    async def run():
        global _goodreads_running, _goodreads_last_error
        _goodreads_running = True
        _goodreads_last_error = None
        try:
            import subprocess, tempfile
            with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            result = await asyncio.to_thread(
                subprocess.run,
                ["python", "-m", "backend.pipelines.goodreads", "--csv", tmp_path],
                capture_output=True, text=True
            )
            tail = (result.stdout or result.stderr or "")[-800:]
            if result.returncode != 0:
                _goodreads_last_error = f"Exit {result.returncode}: {(result.stderr or result.stdout or 'no output')[-400:]}"
                print(f"[goodreads] import FAILED (exit {result.returncode}):", tail)
            else:
                print("[goodreads] import done:", tail)
                # Update pipeline_state timestamp
                conn = db()
                conn.execute("""
                    INSERT INTO pipeline_state (pipeline_name, last_fetched_at)
                    VALUES ('goodreads', now())
                    ON CONFLICT (pipeline_name) DO UPDATE SET last_fetched_at = now()
                """)
                conn.close()
        except Exception as e:
            _goodreads_last_error = str(e)
            print(f"[goodreads] import exception: {e}")
        finally:
            _goodreads_running = False

    asyncio.create_task(run())
    return {"status": "importing"}


@app.post("/pipelines/guitar/upload", status_code=202)
async def upload_guitar(file: UploadFile = File(...)):
    """Accept an Ultimate Guitar My Tabs HTML file, save it, and run the import pipeline."""
    global _guitar_running, _guitar_last_error
    if _guitar_running:
        return {"status": "already_running"}

    contents = await file.read()

    async def run():
        global _guitar_running, _guitar_last_error
        _guitar_running = True
        _guitar_last_error = None
        try:
            import subprocess, tempfile
            with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            result = await asyncio.to_thread(
                subprocess.run,
                ["python", "-m", "backend.pipelines.ug", "--html", tmp_path],
                capture_output=True, text=True
            )
            tail = (result.stdout or result.stderr or "")[-800:]
            if result.returncode != 0:
                _guitar_last_error = f"Exit {result.returncode}: {(result.stderr or result.stdout or 'no output')[-400:]}"
                print(f"[guitar] import FAILED (exit {result.returncode}):", tail)
            else:
                print("[guitar] import done:", tail)
                # Update pipeline_state timestamp
                conn = db()
                conn.execute("""
                    INSERT INTO pipeline_state (pipeline_name, last_fetched_at)
                    VALUES ('guitar_import', now())
                    ON CONFLICT (pipeline_name) DO UPDATE SET last_fetched_at = now()
                """)
                conn.close()
        except Exception as e:
            _guitar_last_error = str(e)
            print(f"[guitar] import exception: {e}")
        finally:
            _guitar_running = False

    asyncio.create_task(run())
    return {"status": "importing"}


@app.post("/pipelines/musicbrainz/enrich", status_code=202)
async def trigger_musicbrainz_enrich():
    """Kick off MusicBrainz artist enrichment in the background (~30-40 min for full run)."""
    global _mb_running, _mb_last_error
    if _mb_running:
        return {"status": "already_running"}

    async def run():
        global _mb_running, _mb_last_error
        _mb_running = True
        _mb_last_error = None
        try:
            import subprocess
            result = await asyncio.to_thread(
                subprocess.run,
                ["python", "-m", "backend.pipelines.musicbrainz"],
                capture_output=True, text=True
            )
            tail = (result.stdout or result.stderr or "")[-800:]
            if result.returncode != 0:
                _mb_last_error = f"Exit {result.returncode}: {(result.stderr or result.stdout or 'no output')[-400:]}"
                print(f"[musicbrainz] enrich FAILED (exit {result.returncode}):", tail)
            else:
                print("[musicbrainz] enrich done:", tail)
        except Exception as e:
            _mb_last_error = str(e)
            print(f"[musicbrainz] enrich exception: {e}")
        finally:
            _mb_running = False

    asyncio.create_task(run())
    return {"status": "enriching"}


@app.post("/pipelines/enrichment/clear-no-data", status_code=200)
def clear_no_data_skips():
    """
    Clear enrichment_skipped entries with reason='no_data' so re-enrichment will
    retry them with updated thresholds. Does NOT touch max_retries entries.
    Call once after lowering Last.fm vote thresholds.
    """
    conn = db()
    result = conn.execute("""
        DELETE FROM enrichment_skipped
        WHERE reason = 'no_data'
          AND entity_type IN ('artist_tags', 'track_tags')
    """)
    deleted = conn.execute("SELECT changes()").fetchone()[0]
    conn.close()
    return {"deleted": deleted}


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"


# ---------------------------------------------------------------------------
# Chat CRUD
# ---------------------------------------------------------------------------

class ChatCreate(BaseModel):
    title: str


class SaveMessagesRequest(BaseModel):
    messages: list[dict]


@app.get("/chats")
def list_chats():
    conn = db()
    rows = conn.execute(
        "SELECT chat_id, title, created_at, updated_at FROM chats ORDER BY updated_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    cols = ["chat_id", "title", "created_at", "updated_at"]
    return [dict(zip(cols, r)) for r in rows]


@app.post("/chats", status_code=201)
def create_chat(body: ChatCreate):
    chat_id = str(uuid4())
    now = datetime.now(tz=timezone.utc)
    conn = db()
    conn.execute(
        "INSERT INTO chats (chat_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [chat_id, body.title, now, now]
    )
    conn.close()
    return {"chat_id": chat_id, "title": body.title, "created_at": now.isoformat()}


@app.get("/chats/{chat_id}/messages")
def get_chat_messages(chat_id: str):
    conn = db()
    rows = conn.execute(
        "SELECT role, content FROM chat_messages WHERE chat_id = ? ORDER BY seq ASC, created_at ASC",
        [chat_id]
    ).fetchall()
    conn.close()
    return [{"role": r[0], "content": r[1]} for r in rows]


@app.post("/chats/{chat_id}/messages", status_code=201)
def save_chat_messages(chat_id: str, body: SaveMessagesRequest):
    conn = db()
    max_seq_row = conn.execute(
        "SELECT COALESCE(MAX(seq), -1) FROM chat_messages WHERE chat_id = ?", [chat_id]
    ).fetchone()
    max_seq = max_seq_row[0] if max_seq_row else -1
    now = datetime.now(tz=timezone.utc)
    for i, msg in enumerate(body.messages):
        conn.execute(
            "INSERT INTO chat_messages (message_id, chat_id, role, content, seq, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [str(uuid4()), chat_id, msg["role"], msg["content"], max_seq + 1 + i, now]
        )
    conn.execute("UPDATE chats SET updated_at = ? WHERE chat_id = ?", [now, chat_id])
    conn.close()
    return {"saved": len(body.messages)}


@app.delete("/chats/{chat_id}", status_code=204)
def delete_chat(chat_id: str):
    conn = db()
    conn.execute("DELETE FROM chat_messages WHERE chat_id = ?", [chat_id])
    result = conn.execute("DELETE FROM chats WHERE chat_id = ?", [chat_id])
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Chat not found")


class PlaylistRequest(BaseModel):
    prompt: str
    playlist_id: str | None = None  # set when modifying an existing playlist


# ---------------------------------------------------------------------------
# Playlist CRUD
# ---------------------------------------------------------------------------

@app.get("/playlists")
def list_playlists():
    conn = db()
    rows = conn.execute(
        "SELECT playlist_id, name, prompt, tracks, shortcuts_url, thoughts, queries, created_at, updated_at "
        "FROM playlists ORDER BY updated_at DESC"
    ).fetchall()
    conn.close()
    cols = ["playlist_id", "name", "prompt", "tracks", "shortcuts_url", "thoughts", "queries", "created_at", "updated_at"]
    return [dict(zip(cols, r)) for r in rows]


@app.delete("/playlists/{playlist_id}", status_code=204)
def delete_playlist(playlist_id: str):
    conn = db()
    result = conn.execute("DELETE FROM playlists WHERE playlist_id = ?", [playlist_id])
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")


@app.post("/agent/playlist")
async def agent_playlist(body: PlaylistRequest):
    """
    Generate or modify a playlist from a natural language prompt.
    Streams SSE. Emits a 'playlist' event with the final JSON, then auto-saves to DB.
    """
    from backend.agent.graph import get_agent

    agent = await get_agent()
    config = {"configurable": {"thread_id": f"playlist-{id(body)}"}}

    # Build the prompt — include existing playlist context when modifying
    if body.playlist_id:
        conn = db()
        row = conn.execute(
            "SELECT name, tracks FROM playlists WHERE playlist_id = ?",
            [body.playlist_id]
        ).fetchone()
        conn.close()
        if row:
            existing = f'Existing playlist "{row[0]}" has tracks: {row[1]}. '
            system_msg = (
                f"{existing}The user wants to modify it: {body.prompt}. "
                "Query their personal data as needed, then call build_playlist with the updated track list."
            )
        else:
            system_msg = (
                f"The user wants a playlist. Query their personal data first, "
                f"then call build_playlist with the result. Their request: {body.prompt}"
            )
    else:
        system_msg = (
            "The user wants a playlist. Query their personal data first, "
            f"then call build_playlist with the result. Their request: {body.prompt}"
        )

    print(f"[playlist] Starting: {body.prompt!r}")

    async def stream():
        queries: list[str] = []
        thoughts_parts: list[str] = []

        gen = agent.astream_events(
            {"messages": [{"role": "user", "content": system_msg}]},
            config=config,
            version="v2",
        )
        try:
            while True:
                try:
                    event = await asyncio.wait_for(gen.__anext__(), timeout=25.0)
                except StopAsyncIteration:
                    break
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                kind = event["event"]
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    text = None
                    if chunk.content and isinstance(chunk.content, list):
                        for part in chunk.content:
                            if isinstance(part, dict) and part.get("type") == "text":
                                text = part["text"]
                    elif isinstance(chunk.content, str) and chunk.content:
                        text = chunk.content
                    if text:
                        thoughts_parts.append(text)
                        encoded = "\n".join(f"data: {line}" for line in text.split("\n"))
                        yield f"{encoded}\n\n"

                elif kind == "on_tool_start":
                    tool = event.get("name", "tool")
                    print(f"[playlist] Tool start: {tool}")
                    # Capture SQL queries for provenance
                    if tool == "query_database":
                        inp = event.get("data", {})
                        if isinstance(inp, dict):
                            sql = inp.get("input", {}).get("sql", "")
                            if sql:
                                queries.append(sql)
                    yield f"event: tool_start\ndata: {tool}\n\n"

                elif kind == "on_tool_end":
                    tool = event.get("name", "")
                    print(f"[playlist] Tool end: {tool}")
                    if tool == "build_playlist":
                        data = event.get("data", {})
                        print(f"[playlist] on_tool_end data type: {type(data).__name__}, keys: {list(data.keys()) if isinstance(data, dict) else 'n/a'}")

                        # LangGraph v2: event["data"] is a dict with key "output" = ToolMessage
                        # Older versions: event["data"] is the ToolMessage directly
                        if isinstance(data, dict):
                            output = data.get("output", "")
                            if hasattr(output, "content"):
                                raw = output.content   # ToolMessage inside dict
                            else:
                                raw = str(output) if output else ""
                        elif hasattr(data, "content"):
                            raw = data.content         # ToolMessage directly
                        else:
                            raw = str(data) if data else ""

                        print(f"[playlist] raw type: {type(raw).__name__}, value: {repr(raw)[:200]}")
                        try:
                            playlist_data = json.loads(raw) if isinstance(raw, str) else raw
                            if isinstance(playlist_data, str):
                                playlist_data = json.loads(playlist_data)
                        except Exception as e:
                            print(f"[playlist] Failed to parse build_playlist output: {e} — raw: {raw!r}")
                            yield f"event: error\ndata: Failed to parse playlist output\n\n"
                            return

                        print(f"[playlist] Built: {playlist_data.get('name')!r} with {len(playlist_data.get('tracks', []))} tracks")

                        thoughts_text = "".join(thoughts_parts)

                        # Auto-save to DB
                        try:
                            now = datetime.now(tz=timezone.utc)
                            pid = body.playlist_id
                            conn = db()
                            if pid:
                                conn.execute(
                                    "UPDATE playlists SET name=?, prompt=?, tracks=?, shortcuts_url=?, "
                                    "thoughts=?, queries=?, updated_at=? WHERE playlist_id=?",
                                    [playlist_data["name"], body.prompt,
                                     json.dumps(playlist_data["tracks"]),
                                     playlist_data["shortcuts_url"],
                                     thoughts_text, json.dumps(queries), now, pid]
                                )
                            else:
                                pid = str(uuid4())
                                conn.execute(
                                    "INSERT INTO playlists "
                                    "(playlist_id, name, prompt, tracks, shortcuts_url, thoughts, queries, created_at, updated_at) "
                                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                    [pid, playlist_data["name"], body.prompt,
                                     json.dumps(playlist_data["tracks"]),
                                     playlist_data["shortcuts_url"],
                                     thoughts_text, json.dumps(queries), now, now]
                                )
                            conn.close()
                            playlist_data["playlist_id"] = pid
                            playlist_data["thoughts"] = thoughts_text
                            playlist_data["queries"] = queries
                            print(f"[playlist] Saved to DB: {pid} ({len(queries)} queries captured)")
                        except Exception as e:
                            print(f"[playlist] DB save failed: {e}")

                        yield f"event: playlist\ndata: {json.dumps(playlist_data)}\n\n"
                    else:
                        yield f"event: tool_end\ndata: done\n\n"

        except Exception as e:
            import traceback
            print(f"[playlist] Stream error: {e}\n{traceback.format_exc()}")
            yield f"event: error\ndata: {str(e)}\n\n"
            return

        if not any("playlist" in t for t in thoughts_parts):
            print("[playlist] WARNING: stream ended with no build_playlist call")

        yield "event: done\ndata: done\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/agent/chat")
async def agent_chat(body: ChatRequest):
    from backend.agent.graph import get_agent

    agent = await get_agent()
    config = {"configurable": {"thread_id": body.thread_id}}

    async def stream():
        # Wrap astream_events with keep-alive: if a tool call takes >25s with no
        # event, emit an SSE comment to prevent mobile browsers from dropping the
        # connection. SSE comments (": ...") are ignored by the client.
        gen = agent.astream_events(
            {"messages": [{"role": "user", "content": body.message}]},
            config=config,
            version="v2",
        )
        try:
            while True:
                try:
                    event = await asyncio.wait_for(gen.__anext__(), timeout=25.0)
                except StopAsyncIteration:
                    break
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue

                kind = event["event"]
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    text = None
                    if chunk.content and isinstance(chunk.content, list):
                        for part in chunk.content:
                            if isinstance(part, dict) and part.get("type") == "text":
                                text = part["text"]
                    elif isinstance(chunk.content, str) and chunk.content:
                        text = chunk.content
                    if text:
                        encoded = "\n".join(f"data: {line}" for line in text.split("\n"))
                        yield f"{encoded}\n\n"
                elif kind == "on_tool_start":
                    tool_name = event.get("name", "tool")
                    yield f"event: tool_start\ndata: {tool_name}\n\n"
                elif kind == "on_tool_end":
                    yield f"event: tool_end\ndata: done\n\n"
        except Exception as e:
            print(f"[chat] Stream error: {e}")
            yield f"event: error\ndata: {str(e)}\n\n"
        yield "event: done\ndata: done\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
