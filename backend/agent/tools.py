"""
Agent tools — everything the agent can call to fetch data.
"""
import duckdb
from langchain_core.tools import tool

from backend.db.schema import DB_PATH


@tool
def query_database(sql: str) -> str:
    """
    Run a read-only SQL query against the personal taste database (DuckDB).

    Tables available:
    - raw_scrobbles(track, artist, album, scrobbled_at, mbid)
    - raw_books(book_id, title, author, isbn, rating 0-5, date_read, shelf, ol_subjects[], ol_description)
    - guitar_songs(song_id, title, artist, part, difficulty 1-5, status, notes, date_started)
    - practice_log(log_id, song_id, practiced_at)
    - artists(artist_id, name)
    - tracks(track_id, title, artist_id)
    - scrobbles(scrobble_id, track_id, artist_id, album_id, scrobbled_at)
    - taste_tags(tag_id, entity_type, entity_id, tag, source)

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
