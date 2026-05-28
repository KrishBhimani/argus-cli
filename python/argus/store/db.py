"""SQLite connection opener + migration runner.

Verifies FTS5 is compiled in at startup; failing fast with a clear error
is better than a confusing OperationalError deep in searchPrompts later.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from .migrations.inline import (
    MIGRATION_001,
    MIGRATION_002,
    MIGRATION_003,
    MIGRATION_004,
    MIGRATION_005,
)

SCHEMA_VERSION = 5


class FTS5NotAvailableError(RuntimeError):
    """Raised when the Python sqlite3 build lacks FTS5 support."""


def _assert_fts5(conn: sqlite3.Connection) -> None:
    """Fail loudly if FTS5 isn't compiled into this Python's sqlite3.

    CPython's standard distributions for Windows / macOS / Linux all ship
    FTS5 since 3.11. Alpine minimal builds and some custom builds don't.
    """
    cur = conn.execute("PRAGMA compile_options")
    opts = {row[0] for row in cur.fetchall()}
    if "ENABLE_FTS5" not in opts:
        raise FTS5NotAvailableError(
            "Your Python's sqlite3 was built without FTS5 (ENABLE_FTS5). "
            "Argus requires FTS5 for prompt and transcript search. "
            "Use the official CPython distribution or build sqlite with FTS5."
        )


def open_db(path: str | Path) -> sqlite3.Connection:
    """Open the Argus SQLite DB at ``path``, applying migrations 1..N."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)

    # check_same_thread=False because the Repository may be accessed from
    # the request thread, the watcher thread, the first-run worker, and
    # the scheduler thread. SQLite itself is thread-safe in serialized
    # mode; better-sqlite3 in TS makes the same assumption.
    #
    # cached_statements=0 disables Python sqlite3's per-Connection
    # prepared-statement cache. With the cache enabled, two threads that
    # call execute(SAME_SQL, ...) concurrently can both pull the cached
    # sqlite3_stmt*, both call reset+bind on it, and one loses with
    # SQLITE_MISUSE ("bad parameter or other API misuse"). The cost of
    # disabling the cache is ~10µs of statement prep per query, which is
    # well below the cost of the queries themselves. SQLite's own internal
    # compilation cache (sqlite3_prepare_v2 fast path) still applies.
    conn = sqlite3.connect(
        str(p),
        check_same_thread=False,
        isolation_level=None,
        cached_statements=0,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")

    _assert_fts5(conn)

    # MIGRATION_001 is fully idempotent (CREATE TABLE IF NOT EXISTS) so we
    # always run it. After this point app_meta is guaranteed to exist.
    conn.executescript(MIGRATION_001)

    # Versioned migrations: ALTER TABLE has no IF NOT EXISTS in SQLite, so
    # we gate later migrations on a schema_version row. Fresh DBs start at
    # 1 (everything in MIGRATION_001 has been applied) and step up.
    row = conn.execute(
        "SELECT value FROM app_meta WHERE key = 'schema_version'"
    ).fetchone()
    current = int(row["value"]) if row else 1

    if current < 2:
        conn.executescript(MIGRATION_002)
        current = 2
    if current < 3:
        conn.executescript(MIGRATION_003)
        current = 3
    if current < 4:
        conn.executescript(MIGRATION_004)
        current = 4
    if current < 5:
        conn.executescript(MIGRATION_005)
        current = 5

    conn.execute(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', ?)",
        (str(SCHEMA_VERSION),),
    )

    return conn
