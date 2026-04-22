"""
Mood analysis pipeline — laptop only (requires transformers + torch).

NOT in requirements.txt. Install manually:
    pip install transformers torch

Reads track_lyrics from a local DuckDB file, runs zero-shot NLP classification
to assign mood tags, and writes results to track_mood.

Workflow:
    1. scp pi@100.116.200.117:/path/to/tastemaker/tastemaker.db ./tastemaker.db
    2. python -m backend.pipelines.analyze_mood
    3. Export: python -c "import duckdb; c=duckdb.connect('tastemaker.db'); c.execute(\"COPY track_mood TO 'mood_export.parquet' (FORMAT PARQUET)\"); c.close()"
    4. scp ./mood_export.parquet pi@100.116.200.117:~/
    5. Import on Pi (see project docs)

Usage:
    python -m backend.pipelines.analyze_mood [--db PATH]
"""
import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

MOOD_LABELS = [
    "melancholic", "euphoric", "anxious", "tender", "defiant",
    "nostalgic", "dark", "hopeful", "lonely", "romantic",
    "bitter", "raw", "peaceful", "restless",
]
MODEL_NAME   = "cross-encoder/nli-deberta-v3-small"
SCORE_THRESH = 0.3
MAX_TOKENS   = 512


def _truncate_to_tokens(text: str, tokenizer) -> str:
    ids = tokenizer.encode(text, add_special_tokens=False)
    if len(ids) <= MAX_TOKENS:
        return text
    return tokenizer.decode(ids[:MAX_TOKENS], skip_special_tokens=True)


def run(db_path: Path):
    try:
        from transformers import pipeline as hf_pipeline, AutoTokenizer
    except ImportError:
        log.error("transformers not installed. Run: pip install transformers torch")
        raise SystemExit(1)

    import duckdb

    log.info(f"[mood] Loading model {MODEL_NAME!r}…")
    classifier = hf_pipeline("zero-shot-classification", model=MODEL_NAME, device=-1)
    tokenizer  = AutoTokenizer.from_pretrained(MODEL_NAME)
    log.info("[mood] Model loaded.")

    conn = duckdb.connect(str(db_path))

    rows = conn.execute("""
        SELECT l.track, l.artist, l.lyrics
        FROM track_lyrics l
        WHERE NOT EXISTS (
            SELECT 1 FROM track_mood m
            WHERE m.track = l.track AND m.artist = l.artist AND m.overridden = TRUE
        )
        ORDER BY l.artist, l.track
    """).fetchall()

    log.info(f"[mood] {len(rows)} tracks to analyze")

    for i, (track, artist, lyrics) in enumerate(rows):
        truncated = _truncate_to_tokens(lyrics, tokenizer)

        try:
            result = classifier(truncated, MOOD_LABELS, multi_label=True)
        except Exception as e:
            log.warning(f"[mood] Classification error for {artist!r} — {track!r}: {e}")
            continue

        scores_dict = dict(zip(result["labels"], result["scores"]))
        tags = [label for label, score in scores_dict.items() if score >= SCORE_THRESH]

        conn.execute("""
            INSERT INTO track_mood (track, artist, tags, scores, model, analyzed_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (track, artist) DO UPDATE SET
                tags        = excluded.tags,
                scores      = excluded.scores,
                model       = excluded.model,
                analyzed_at = excluded.analyzed_at
        """, (track, artist, tags, json.dumps(scores_dict), MODEL_NAME, datetime.now(tz=timezone.utc)))

        if (i + 1) % 50 == 0:
            log.info(f"[mood] {i + 1}/{len(rows)} analyzed")

    conn.close()
    log.info(f"[mood] Done. {len(rows)} tracks analyzed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=Path(__file__).parent.parent.parent / "tastemaker.db")
    args = parser.parse_args()
    run(args.db)
