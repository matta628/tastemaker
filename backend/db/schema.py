"""
DuckDB schema creation. Run once to initialize tastemaker.db.
"""
import duckdb
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "tastemaker.db"


def get_connection(read_only: bool = False) -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(DB_PATH), read_only=read_only)


def create_schema():
    conn = get_connection()

    # -------------------------------------------------------------------------
    # Pipeline state — tracks incremental sync cursors
    # -------------------------------------------------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_state (
            pipeline_name  VARCHAR PRIMARY KEY,
            last_fetched_at TIMESTAMPTZ
        )
    """)

    # -------------------------------------------------------------------------
    # Raw tables — direct ingestion, no transformation
    # -------------------------------------------------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw_scrobbles (
            track       VARCHAR NOT NULL,
            artist      VARCHAR NOT NULL,
            album       VARCHAR,
            scrobbled_at TIMESTAMPTZ NOT NULL,
            mbid        VARCHAR,
            PRIMARY KEY (artist, track, scrobbled_at)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw_books (
            book_id         VARCHAR PRIMARY KEY,  -- Goodreads book ID
            title           VARCHAR NOT NULL,
            author          VARCHAR,
            isbn            VARCHAR,
            isbn13          VARCHAR,
            rating          INTEGER,              -- 0-5, 0 = not rated
            date_read       DATE,
            date_added      DATE,
            shelf           VARCHAR,
            bookshelves     VARCHAR,
            exclusive_shelf VARCHAR,
            publisher       VARCHAR,
            year_published  INTEGER,
            original_year   INTEGER,
            num_pages       INTEGER,
            ol_subjects     VARCHAR[],            -- OpenLibrary subjects
            ol_description  TEXT                  -- OpenLibrary description
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw_reddit_posts (
            post_id     VARCHAR PRIMARY KEY,
            subreddit   VARCHAR NOT NULL,
            title       VARCHAR NOT NULL,
            body        TEXT,
            upvotes     INTEGER,
            created_at  TIMESTAMPTZ
        )
    """)

    # -------------------------------------------------------------------------
    # Guitar songs — written directly by the React app (no pipeline)
    # -------------------------------------------------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS guitar_songs (
            song_id      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            title        VARCHAR NOT NULL,
            artist       VARCHAR NOT NULL,
            part         VARCHAR CHECK (part IN ('chords', 'tabs', 'solo')),
            difficulty   INTEGER CHECK (difficulty BETWEEN 1 AND 5),       -- NULL = not yet validated
            status       VARCHAR CHECK (status IN (
                             'want_to_learn', 'learning', 'learned', 'abandoned'
                         )),                                                -- NULL = not yet validated
            notes        TEXT,
            date_started DATE DEFAULT CURRENT_DATE,
            created_at   TIMESTAMPTZ DEFAULT now(),
            updated_at   TIMESTAMPTZ DEFAULT now()
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS practice_log (
            log_id      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            song_id     VARCHAR NOT NULL REFERENCES guitar_songs(song_id),
            practiced_at TIMESTAMPTZ DEFAULT now()
        )
    """)

    # -------------------------------------------------------------------------
    # Dimension tables — built from raw by dbt
    # -------------------------------------------------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS artists (
            artist_id   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            name        VARCHAR NOT NULL UNIQUE
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS albums (
            album_id    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            title       VARCHAR NOT NULL,
            artist_id   VARCHAR REFERENCES artists(artist_id),
            UNIQUE (title, artist_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS tracks (
            track_id    VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            title       VARCHAR NOT NULL,
            artist_id   VARCHAR REFERENCES artists(artist_id),
            UNIQUE (title, artist_id)
        )
    """)

    # -------------------------------------------------------------------------
    # Fact tables — built by dbt
    # -------------------------------------------------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scrobbles (
            scrobble_id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            track_id    VARCHAR REFERENCES tracks(track_id),
            artist_id   VARCHAR REFERENCES artists(artist_id),
            album_id    VARCHAR REFERENCES albums(album_id),
            scrobbled_at TIMESTAMPTZ NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS listening_sessions (
            session_id   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            started_at   TIMESTAMPTZ NOT NULL,
            ended_at     TIMESTAMPTZ NOT NULL,
            track_count  INTEGER NOT NULL
        )
    """)

    # -------------------------------------------------------------------------
    # Enrichment tables — populated by lastfm enrichment pipeline
    # -------------------------------------------------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS artist_tags (
            artist_name  VARCHAR NOT NULL,
            tag          VARCHAR NOT NULL,
            weight       INTEGER NOT NULL,   -- 0-100, Last.fm community weight
            PRIMARY KEY (artist_name, tag)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS artist_similar (
            artist_name     VARCHAR NOT NULL,
            similar_artist  VARCHAR NOT NULL,
            similarity      FLOAT NOT NULL,  -- 0-1, Last.fm similarity score
            PRIMARY KEY (artist_name, similar_artist)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS track_tags (
            track        VARCHAR NOT NULL,
            artist       VARCHAR NOT NULL,
            tag          VARCHAR NOT NULL,
            weight       INTEGER NOT NULL,   -- 0-100
            PRIMARY KEY (track, artist, tag)
        )
    """)

    # -------------------------------------------------------------------------
    # taste_tags — the cross-domain junction table
    # Maps both books and artists to a shared tag/genre namespace.
    # This is what lets the agent traverse from music → books → guitar.
    # -------------------------------------------------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS taste_tags (
            tag_id      VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type VARCHAR NOT NULL CHECK (entity_type IN ('book', 'artist', 'track')),
            entity_id   VARCHAR NOT NULL,
            tag         VARCHAR NOT NULL,
            source      VARCHAR NOT NULL,    -- 'openlibrary', 'lastfm', 'manual'
            UNIQUE (entity_type, entity_id, tag)
        )
    """)

    conn.close()
    print(f"Schema created at {DB_PATH}")


if __name__ == "__main__":
    create_schema()
