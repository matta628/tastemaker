-- Aggregated listening stats per artist.
-- Play count, first/last seen, top track.
WITH track_counts AS (
    SELECT
        artist,
        track,
        COUNT(*) AS play_count
    FROM {{ ref('stg_scrobbles') }}
    GROUP BY artist, track
),
ranked_tracks AS (
    SELECT
        artist,
        track,
        play_count,
        ROW_NUMBER() OVER (PARTITION BY artist ORDER BY play_count DESC) AS rn
    FROM track_counts
),
top_tracks AS (
    SELECT artist, track AS top_track, play_count AS top_track_plays
    FROM ranked_tracks WHERE rn = 1
)
SELECT
    s.artist,
    COUNT(*)                            AS total_plays,
    COUNT(DISTINCT s.track)             AS unique_tracks,
    MIN(s.scrobbled_at)                 AS first_scrobble,
    MAX(s.scrobbled_at)                 AS last_scrobble,
    MAX(s.scrobble_year)                AS most_recent_year,
    tt.top_track,
    tt.top_track_plays
FROM {{ ref('stg_scrobbles') }} s
LEFT JOIN top_tracks tt ON s.artist = tt.artist
GROUP BY s.artist, tt.top_track, tt.top_track_plays
ORDER BY total_plays DESC
