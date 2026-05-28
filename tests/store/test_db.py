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


def test_open_db_creates_alerts_table(db_path):
    conn = open_db(db_path)
    try:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='alerts'"
        ).fetchone()
        assert row is not None
    finally:
        conn.close()


def test_open_db_applies_migration_005(db_path):
    from argus.store.db import SCHEMA_VERSION

    conn = open_db(db_path)
    try:
        assert SCHEMA_VERSION == 5
        row = conn.execute(
            "SELECT value FROM app_meta WHERE key='schema_version'"
        ).fetchone()
        assert row["value"] == "5"
    finally:
        conn.close()


def test_alerts_has_resolved_at_column(db_path):
    conn = open_db(db_path)
    try:
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(alerts)").fetchall()}
        assert "resolved_at" in cols
    finally:
        conn.close()


def test_connection_handles_concurrent_same_sql_across_threads(db_path):
    """Two threads hammering the same SELECT must not hit SQLITE_MISUSE.

    Regression for: scheduler thread + server request thread both calling
    ``aggregate_turns_by_day`` (same SQL string) raced on the shared
    Connection's prepared-statement cache and lost with
    ``sqlite3.InterfaceError: bad parameter or other API misuse``. Fix
    was passing ``cached_statements=0`` to ``sqlite3.connect``.
    """
    import threading

    conn = open_db(db_path)
    # Seed a single session so the query has rows to iterate.
    conn.execute(
        "INSERT INTO sessions (id, agent, project_path, started_at, primary_model, "
        "pricing_table_version, computed_at) VALUES (?, 'x', '/p', ?, 'm', 'v', ?)",
        ("s1", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
    )

    errors: list[Exception] = []

    def hammer():
        try:
            for _ in range(100):
                conn.execute(
                    "SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?",
                    (100, 0),
                ).fetchall()
        except Exception as e:  # noqa: BLE001
            errors.append(e)

    threads = [threading.Thread(target=hammer) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    conn.close()
    assert errors == [], f"Concurrent same-SQL execute raised: {errors[:3]}"


def test_alerts_unique_on_detector_and_dedup_key(db_path):
    import sqlite3

    conn = open_db(db_path)
    try:
        conn.execute(
            "INSERT INTO alerts (detector, dedup_key, severity, title, message, metadata, first_seen_at, last_seen_at) "
            "VALUES (?, ?, 'warning', 't', 'm', '{}', '2026-05-26T00:00:00Z', '2026-05-26T00:00:00Z')",
            ("cost_outlier", "2026-05-26"),
        )
        try:
            conn.execute(
                "INSERT INTO alerts (detector, dedup_key, severity, title, message, metadata, first_seen_at, last_seen_at) "
                "VALUES (?, ?, 'warning', 't', 'm', '{}', '2026-05-26T01:00:00Z', '2026-05-26T01:00:00Z')",
                ("cost_outlier", "2026-05-26"),
            )
            raise AssertionError("expected IntegrityError on duplicate (detector, dedup_key)")
        except sqlite3.IntegrityError:
            pass
    finally:
        conn.close()
