"""
FastAPI application — Guitar song CRUD + practice logging.
"""
from datetime import date, datetime, timezone
from typing import Literal
from uuid import uuid4

import duckdb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.db.schema import DB_PATH

app = FastAPI(title="Tastemaker API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
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
