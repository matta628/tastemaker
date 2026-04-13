"""
Playlist delivery service.

Currently uses the iOS Shortcuts bridge — encodes the playlist as a
shortcuts:// URL that the PWA opens, triggering a pre-built Shortcut
that creates the playlist in Apple Music.

Future upgrade: when an Apple Developer account is available, swap
create() to call the MusicKit REST API instead. The agent tool and
frontend button require zero changes.
"""
import urllib.parse


def build_shortcuts_url(name: str, tracks: list[dict]) -> str:
    """
    Encode a playlist into a shortcuts:// URL.

    The Shortcut receives newline-separated lines where:
    - Line 0: playlist name
    - Lines 1+: "Artist — Track" for each song

    Args:
        name:   Playlist name
        tracks: List of {"title": ..., "artist": ...} dicts

    Returns:
        A shortcuts:// URL string ready to be opened on iPhone.
    """
    lines = [name] + [f"{t['artist']} — {t['title']}" for t in tracks]
    text = "\n".join(lines)
    encoded = urllib.parse.quote(text, safe="")
    return f"shortcuts://run-shortcut?name=TastemakerPlaylist&input=text&text={encoded}"


# ---------------------------------------------------------------------------
# Future: Apple Music REST API (uncomment when developer account is ready)
# ---------------------------------------------------------------------------
# import os, time, jwt, requests
#
# def _developer_token() -> str:
#     key_id   = os.environ["APPLE_MUSIC_KEY_ID"]
#     team_id  = os.environ["APPLE_MUSIC_TEAM_ID"]
#     key      = os.environ["APPLE_MUSIC_PRIVATE_KEY"]   # base64-decoded .p8
#     payload  = {"iss": team_id, "iat": int(time.time()), "exp": int(time.time()) + 15777000}
#     return jwt.encode(payload, key, algorithm="ES256", headers={"kid": key_id})
#
# def create_via_api(name: str, tracks: list[dict], user_token: str) -> str:
#     """Create a playlist via MusicKit REST API. Returns deep link."""
#     headers = {
#         "Authorization": f"Bearer {_developer_token()}",
#         "Music-User-Token": user_token,
#     }
#     body = {
#         "attributes": {"name": name},
#         "relationships": {
#             "tracks": {"data": [{"id": t["apple_id"], "type": "songs"} for t in tracks]}
#         }
#     }
#     resp = requests.post(
#         "https://api.music.apple.com/v1/me/library/playlists",
#         headers=headers, json=body, timeout=15,
#     )
#     resp.raise_for_status()
#     playlist_id = resp.json()["data"][0]["id"]
#     return f"music://music.apple.com/library/playlist/{playlist_id}"
