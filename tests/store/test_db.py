"""Schema + migrations smoke tests."""
from __future__ import annotations

from argus.store.db import open_db


def test_creates_schema_on_first_open(db_path):
    db = open_db(db_path)
    try:
        rows = db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        names = {r["name"] for r in rows}
        for tbl in {
            "sessions",
            "turns",
            "file_offsets",
            "parse_errors",
            "app_meta",
            "tool_calls",
            "prompts",
            "transcript_segments",
        }:
            assert tbl in names
    finally:
        db.close()


def test_enables_wal_mode(db_path):
    db = open_db(db_path)
    try:
        r = db.execute("PRAGMA journal_mode").fetchone()
        assert r[0] == "wal"
    finally:
        db.close()


def test_is_idempotent(db_path):
    open_db(db_path).close()
    # Second open must not raise.
    db = open_db(db_path)
    db.close()


def test_fts5_compiled_in(db_path):
    db = open_db(db_path)
    try:
        opts = {r[0] for r in db.execute("PRAGMA compile_options").fetchall()}
        assert "ENABLE_FTS5" in opts
    finally:
        db.close()
