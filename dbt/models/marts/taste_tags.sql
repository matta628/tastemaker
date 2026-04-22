-- Cross-domain taste tags — the junction table that makes the agent work.
-- Pulls genre/mood tags from two sources:
--   1. Books: OpenLibrary subjects
--   2. Artists: derived from top genre keywords in artist names / albums
--      (Last.fm tag API enrichment can be added later)
--
-- Unified tag namespace means the agent can ask:
--   "What tags do my most-played artists share with my highest-rated books?"

-- Book tags from OpenLibrary subjects
WITH book_tags AS (
    SELECT
        book_id          AS entity_id,
        'book'           AS entity_type,
        LOWER(TRIM(UNNEST(ol_subjects))) AS tag,
        'openlibrary'    AS source
    FROM {{ ref('stg_books') }}
    WHERE ol_subjects IS NOT NULL
      AND rating >= 4            -- only from books I actually liked
),

-- Dedupe (same book can have same subject listed twice)
deduped_book_tags AS (
    SELECT DISTINCT entity_id, entity_type, tag, source
    FROM book_tags
    WHERE tag != ''
      AND LENGTH(tag) < 100     -- filter noise
),

-- Artist tags from Last.fm enrichment, filtered to meaningfully-played artists.
artist_stubs AS (
    SELECT DISTINCT
        at.artist_name   AS entity_id,
        'artist'         AS entity_type,
        at.tag           AS tag,
        'lastfm'         AS source
    FROM {{ source('enrichment', 'artist_tags') }} at
    INNER JOIN {{ ref('artist_stats') }} stats
        ON at.artist_name = stats.artist
    WHERE stats.total_plays >= 10
      AND at.weight >= 10
      AND at.tag != ''
)

SELECT * FROM deduped_book_tags

UNION ALL

SELECT * FROM artist_stubs
