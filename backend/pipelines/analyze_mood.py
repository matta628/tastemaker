"""
Mood analysis pipeline — laptop only (requires transformers + torch).

NOT in requirements.txt. Install manually:
    pip install transformers torch

Reads track_lyrics from the main DB (read-only, no lock held), runs zero-shot
NLP classification, and writes results to a sidecar mood_work.db so the main
database stays available for normal development work throughout the run.

Workflow:
    1. scp pi@100.116.200.117:/path/to/tastemaker/tastemaker.db ./tastemaker.db
    2. python -m backend.pipelines.analyze_mood          # writes to mood_work.db
    3. python -m backend.pipelines.analyze_mood --merge  # folds mood_work.db → tastemaker.db
    4. Export: python -c "import duckdb; c=duckdb.connect('tastemaker.db'); c.execute(\"COPY track_mood TO 'mood_export.parquet' (FORMAT PARQUET)\"); c.close()"
    5. scp ./mood_export.parquet pi@100.116.200.117:~/
    6. Import on Pi (see project docs)

Usage:
    python -m backend.pipelines.analyze_mood [--db PATH] [--work-db PATH] [--merge] [--reanalyze]
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
    "happy", "angry", "energetic", "playful",
    "dance", "psychedelic", "otherworldly",
]
MODEL_NAME   = "cross-encoder/nli-deberta-v3-small"
SCORE_THRESH = 0.3
MAX_TOKENS   = 512

_CREATE_TRACK_MOOD = """
    CREATE TABLE IF NOT EXISTS track_mood (
        track       VARCHAR NOT NULL,
        artist      VARCHAR NOT NULL,
        tags        VARCHAR[],
        scores      JSON,
        model       VARCHAR,
        overridden  BOOLEAN DEFAULT FALSE,
        analyzed_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (track, artist)
    )
"""


def _truncate_to_tokens(text: str, tokenizer) -> str:
    ids = tokenizer.encode(text, add_special_tokens=False)
    if len(ids) <= MAX_TOKENS:
        return text
    return tokenizer.decode(ids[:MAX_TOKENS], skip_special_tokens=True)


def merge(db_path: Path, work_db_path: Path):
    """Copy completed mood rows from mood_work.db into the main tastemaker.db."""
    import duckdb

    if not work_db_path.exists():
        log.error(f"[mood] Work DB not found: {work_db_path}")
        raise SystemExit(1)

    conn = duckdb.connect(str(db_path))
    conn.execute(f"ATTACH '{work_db_path}' AS work_src (READ_ONLY)")

    count = conn.execute("SELECT COUNT(*) FROM work_src.track_mood").fetchone()[0]
    log.info(f"[mood] Merging {count} rows from {work_db_path.name} → {db_path.name}")

    conn.execute("""
        INSERT INTO track_mood (track, artist, tags, scores, model, overridden, analyzed_at)
        SELECT track, artist, tags, scores, model, overridden, analyzed_at
        FROM work_src.track_mood
        ON CONFLICT (track, artist) DO UPDATE SET
            tags        = excluded.tags,
            scores      = excluded.scores,
            model       = excluded.model,
            analyzed_at = excluded.analyzed_at
    """)

    merged = conn.execute("SELECT COUNT(*) FROM track_mood").fetchone()[0]
    conn.close()
    log.info(f"[mood] Merge done. track_mood now has {merged} rows in {db_path.name}.")


def run(db_path: Path, work_db_path: Path, reanalyze: bool = False):
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

    # Read everything from the main DB then release the lock immediately — before any ML work.
    src = duckdb.connect(str(db_path))
    existing_main = {(r[0], r[1]) for r in src.execute("SELECT track, artist FROM track_mood").fetchall()}
    all_lyrics = src.execute(
        "SELECT track, artist, lyrics FROM track_lyrics ORDER BY artist, track"
    ).fetchall()
    src.close()  # main DB fully unlocked from this point on

    # Open the work DB and check what's already done there (handles restarts mid-run).
    conn = duckdb.connect(str(work_db_path))
    conn.execute(_CREATE_TRACK_MOOD)
    existing_work = {(r[0], r[1]) for r in conn.execute("SELECT track, artist FROM track_mood").fetchall()}

    already_done = existing_main | existing_work
    rows = all_lyrics if reanalyze else [(t, a, l) for t, a, l in all_lyrics if (t, a) not in already_done]

    log.info(f"[mood] Main DB released. {len(rows)} tracks to analyze → writing to {work_db_path.name}")


    for i, (track, artist, lyrics) in enumerate(rows):
        truncated = _truncate_to_tokens(lyrics, tokenizer)

        try:
            result = classifier(truncated, MOOD_LABELS, multi_label=True, truncation=True)
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
    log.info(f"[mood] Done. {len(rows)} tracks analyzed. Run with --merge when ready to fold into {db_path.name}.")


if __name__ == "__main__":
    _default_db = Path(__file__).parent.parent.parent / "tastemaker.db"
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=_default_db)
    parser.add_argument("--work-db", type=Path, default=None,
                        help="Sidecar DB for ML output (default: mood_work.db next to --db)")
    parser.add_argument("--reanalyze", action="store_true",
                        help="Re-run all already-analyzed tracks (use after adding new labels)")
    parser.add_argument("--merge", action="store_true",
                        help="Merge completed mood_work.db results back into the main DB")
    args = parser.parse_args()

    work_db = args.work_db or (args.db.parent / "mood_work.db")

    if args.merge:
        merge(args.db, work_db)
    else:
        run(args.db, work_db, reanalyze=args.reanalyze)
