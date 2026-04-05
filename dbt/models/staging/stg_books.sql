-- Clean raw Goodreads books.
-- Normalizes shelf names, filters junk, casts types.
SELECT
    book_id,
    title,
    author,
    isbn,
    isbn13,
    CASE
        WHEN rating = 0 THEN NULL   -- 0 = not rated in Goodreads
        ELSE rating
    END AS rating,
    date_read,
    date_added,
    -- Normalize exclusive_shelf to a clean enum
    CASE exclusive_shelf
        WHEN 'read'            THEN 'read'
        WHEN 'currently-reading' THEN 'reading'
        WHEN 'to-read'         THEN 'want_to_read'
        ELSE exclusive_shelf
    END AS shelf,
    publisher,
    year_published,
    num_pages,
    ol_subjects,
    ol_description
FROM {{ source('raw', 'raw_books') }}
WHERE title IS NOT NULL AND title != ''
