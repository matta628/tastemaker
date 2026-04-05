-- Expose guitar_songs table with validated enums.
-- guitar_songs is written directly by the app, so this is a lightweight pass-through.
SELECT
    song_id,
    title,
    artist,
    part,   -- 'chords', 'tabs', 'solo', or NULL (general)
    difficulty,
    status,
    notes,
    date_started,
    created_at,
    updated_at
FROM {{ source('raw', 'guitar_songs') }}
WHERE difficulty BETWEEN 1 AND 5
  AND status IN ('want_to_learn', 'learning', 'learned', 'abandoned')
