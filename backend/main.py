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
import duckdb
import requests
from bs4 import BeautifulSoup
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pathlib import Path
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv(".env.secret")

LYRICS_CACHE = Path("lyrics_cache.json")
LYRICS_CACHE_MAX_AGE_DAYS = 7

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


def _genius_snippet(track: str, artist: str, token: str) -> str | None:
    """Search Genius for a track and scrape a short lyric snippet."""
    try:
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.get(
            "https://api.genius.com/search",
            headers=headers,
            params={"q": f"{track} {artist}"},
            timeout=5,
        )
        hits = res.json().get("response", {}).get("hits", [])
        if not hits:
            return None
        url = hits[0]["result"]["url"]

        page = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(page.text, "html.parser")

        containers = soup.find_all("div", attrs={"data-lyrics-container": "true"})
        lines = []
        for container in containers:
            for br in container.find_all("br"):
                br.replace_with("\n")
            for line in container.get_text("\n").splitlines():
                line = line.strip()
                if line and not line.startswith("["):
                    lines.append(line)
            if len(lines) >= 6:
                break

        if len(lines) < 2:
            return None

        start = max(0, len(lines) // 3)
        return " / ".join(lines[start:start + 3])
    except Exception:
        return None


async def _lyrics_background_fetch():
    """On startup: fetch Genius snippets for top 100 tracks (30 months), cache to disk.
    Skips if cache is fresh. Rate-limited to ~1 search+scrape per 2 seconds."""
    token = os.environ.get("GENIUS_ACCESS_TOKEN")
    if not token:
        print("[lyrics] No GENIUS_ACCESS_TOKEN found — skipping lyrics fetch")
        return

    if LYRICS_CACHE.exists():
        age_days = (time.time() - LYRICS_CACHE.stat().st_mtime) / 86400
        if age_days < LYRICS_CACHE_MAX_AGE_DAYS:
            cached = json.loads(LYRICS_CACHE.read_text())
            print(f"[lyrics] Cache is fresh ({age_days:.1f} days old, {len(cached)} tracks) — skipping fetch")
            return

    await asyncio.sleep(5)
    print("[lyrics] Starting Genius lyrics fetch for top 100 tracks (30 months)…")

    try:
        conn = duckdb.connect(str(DB_PATH), read_only=True)
        rows = conn.execute("""
            SELECT track, artist, COUNT(*) as plays
            FROM raw_scrobbles
            WHERE scrobbled_at >= now() - INTERVAL '30 months'
            GROUP BY track, artist
            ORDER BY plays DESC
            LIMIT 100
        """).fetchall()
        conn.close()
        print(f"[lyrics] Got {len(rows)} tracks to look up")
    except Exception as e:
        print(f"[lyrics] DB query failed: {e}")
        return

    results = []
    for i, (track, artist, plays) in enumerate(rows):
        snippet = await asyncio.to_thread(_genius_snippet, track, artist, token)
        if snippet:
            results.append({"track": track, "artist": artist, "plays": plays, "snippet": snippet})
            print(f"[lyrics] ({i+1}/{len(rows)}) ✓ {artist} — {track}")
        else:
            print(f"[lyrics] ({i+1}/{len(rows)}) ✗ {artist} — {track} (not found)")
        await asyncio.sleep(2)

    LYRICS_CACHE.write_text(json.dumps(results))
    print(f"[lyrics] Done — {len(results)}/{len(rows)} tracks with snippets cached")


@app.get("/taste/lyrics-snippets")
def lyrics_snippets():
    """Return cached Genius lyric snippets. Cache is populated in background on startup."""
    if LYRICS_CACHE.exists():
        return json.loads(LYRICS_CACHE.read_text())
    return []


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"


@app.post("/agent/chat")
async def agent_chat(body: ChatRequest):
    from backend.agent.graph import get_agent

    agent = get_agent()
    config = {"configurable": {"thread_id": body.thread_id}}

    async def stream():
        async for event in agent.astream_events(
            {"messages": [{"role": "user", "content": body.message}]},
            config=config,
            version="v2",
        ):
            kind = event["event"]
            # Stream text tokens as they arrive
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
                    # SSE spec: newlines in data must be split into multiple data: lines
                    encoded = "\n".join(f"data: {line}" for line in text.split("\n"))
                    yield f"{encoded}\n\n"
            # Signal tool calls so the UI can show "Querying database..."
            elif kind == "on_tool_start":
                tool_name = event.get("name", "tool")
                yield f"event: tool_start\ndata: {tool_name}\n\n"
            elif kind == "on_tool_end":
                yield f"event: tool_end\ndata: done\n\n"
        yield "event: done\ndata: done\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
