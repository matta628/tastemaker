-- Groups scrobbles into listening sessions.
-- A new session starts when the gap between scrobbles exceeds 30 minutes.
WITH gaps AS (
    SELECT
        artist,
        track,
        scrobbled_at,
        LAG(scrobbled_at) OVER (ORDER BY scrobbled_at) AS prev_scrobbled_at
    FROM {{ ref('stg_scrobbles') }}
),
session_starts AS (
    SELECT
        scrobbled_at,
        artist,
        track,
        CASE
            WHEN prev_scrobbled_at IS NULL
              OR datediff('minute', prev_scrobbled_at, scrobbled_at) > 30
            THEN 1 ELSE 0
        END AS is_session_start
    FROM gaps
),
session_ids AS (
    SELECT
        scrobbled_at,
        artist,
        track,
        SUM(is_session_start) OVER (ORDER BY scrobbled_at ROWS UNBOUNDED PRECEDING) AS session_id
    FROM session_starts
)
SELECT
    session_id,
    MIN(scrobbled_at)   AS started_at,
    MAX(scrobbled_at)   AS ended_at,
    COUNT(*)            AS track_count,
    datediff('minute', MIN(scrobbled_at), MAX(scrobbled_at)) AS duration_minutes
FROM session_ids
GROUP BY session_id
ORDER BY started_at DESC
