"""
Unit tests for agent tools — run against the test DB, no API calls.
"""
import json
import pytest


def test_query_database_returns_data(test_db_path, monkeypatch):
    import backend.agent.tools as tools_module
    monkeypatch.setattr(tools_module, "DB_PATH", test_db_path)

    result = tools_module.query_database.invoke(
        {"sql": "SELECT artist, COUNT(*) as plays FROM raw_scrobbles GROUP BY artist ORDER BY plays DESC"}
    )
    assert "The Beatles" in result
    assert "Pink Floyd" in result


def test_query_database_empty_result(test_db_path, monkeypatch):
    import backend.agent.tools as tools_module
    monkeypatch.setattr(tools_module, "DB_PATH", test_db_path)

    result = tools_module.query_database.invoke(
        {"sql": "SELECT * FROM raw_scrobbles WHERE artist = 'nobody'"}
    )
    assert result == "Query returned no rows."


def test_query_database_bad_sql(test_db_path, monkeypatch):
    import backend.agent.tools as tools_module
    monkeypatch.setattr(tools_module, "DB_PATH", test_db_path)

    result = tools_module.query_database.invoke({"sql": "SELECT * FROM nonexistent_table"})
    assert "Query error" in result


def test_build_playlist_structure():
    from backend.agent.tools import build_playlist

    tracks = [
        {"title": "Blackbird", "artist": "The Beatles"},
        {"title": "Wish You Were Here", "artist": "Pink Floyd"},
    ]
    raw = build_playlist.invoke({"name": "Test Mix", "tracks": tracks})
    data = json.loads(raw)

    assert data["name"] == "Test Mix"
    assert len(data["tracks"]) == 2
    assert data["tracks"][0] == {"title": "Blackbird", "artist": "The Beatles"}
    assert "shortcuts_url" in data
    assert data["shortcuts_url"].startswith("shortcuts://")


def test_build_playlist_caps_at_250():
    from backend.agent.tools import build_playlist

    tracks = [{"title": f"Track {i}", "artist": "Artist"} for i in range(300)]
    raw = build_playlist.invoke({"name": "Big List", "tracks": tracks})
    data = json.loads(raw)

    assert len(data["tracks"]) == 250
