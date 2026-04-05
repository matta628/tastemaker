-- Clean scrobbles. No dedup needed — raw_scrobbles has a PRIMARY KEY.
SELECT
    track,
    artist,
    album,
    scrobbled_at,
    mbid,
    CAST(DATE_TRUNC('day', scrobbled_at) AS DATE)   AS scrobble_date,
    CAST(DATE_TRUNC('month', scrobbled_at) AS DATE)  AS scrobble_month,
    EXTRACT(year FROM scrobbled_at)                  AS scrobble_year
FROM {{ source('raw', 'raw_scrobbles') }}
WHERE track IS NOT NULL AND artist IS NOT NULL
