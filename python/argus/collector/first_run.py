"""First-pass ingest: walk every adapter's files, recent first.

Recent files run synchronously in the foreground so the dashboard is
useful immediately. Older files run in a background ThreadPoolExecutor.
"""
from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from ..adapters.base import Adapter
from ..pricing.types import PricingTable
from ..store.repository import Repository
from .pipeline import ingest_file

logger = logging.getLogger(__name__)


@dataclass
class IngestStatus:
    foreground_complete: bool
    pending: int
    processed: int
    total: int


class FirstRunHandle:
    """Returned by ``run_first_pass_ingest``; exposes foreground/backfill futures."""

    def __init__(self) -> None:
        self._processed = 0
        self._total = 0
        self._foreground_complete = False
        self._lock = threading.Lock()
        self._foreground_done = threading.Event()
        self._backfill_done = threading.Event()

    def _inc(self) -> None:
        with self._lock:
            self._processed += 1

    def status(self) -> IngestStatus:
        with self._lock:
            return IngestStatus(
                foreground_complete=self._foreground_complete,
                pending=max(0, self._total - self._processed),
                processed=self._processed,
                total=self._total,
            )

    def wait_foreground(self, timeout: float | None = None) -> bool:
        return self._foreground_done.wait(timeout)

    def wait_backfill(self, timeout: float | None = None) -> bool:
        return self._backfill_done.wait(timeout)


def run_first_pass_ingest(
    adapters: list[Adapter],
    repo: Repository,
    table: PricingTable,
    *,
    recent_days: int = 30,
) -> FirstRunHandle:
    """Kick off ingest. Recent files run inline; older files in a thread.

    Returns immediately with a handle whose ``status()`` is pollable, and
    whose ``wait_foreground()`` / ``wait_backfill()`` block until each
    phase finishes.
    """
    cutoff = time.time() - recent_days * 86_400
    handle = FirstRunHandle()

    # Phase 1 (foreground, sync, in the calling thread).
    recent: list[tuple[Adapter, Path]] = []
    older: list[tuple[Adapter, Path]] = []
    for a in adapters:
        for f in a.discover_session_files():
            try:
                mtime = f.stat().st_mtime
            except OSError:
                continue
            (recent if mtime >= cutoff else older).append((a, f))

    with handle._lock:
        handle._total = len(recent) + len(older)

    for adapter, file in recent:
        try:
            ingest_file(adapter, file, repo, table)
        except Exception as e:  # noqa: BLE001
            repo.record_parse_error(
                {
                    "file": str(file),
                    "byte_offset": -1,
                    "reason": f"[ingest] {e}",
                    "raw_line_truncated": "",
                }
            )
        handle._inc()

    # Also ingest adapter-specific extras (e.g., history.jsonl) during the
    # foreground phase so they're available to the dashboard immediately.
    for a in adapters:
        for extra in a.extra_watch_paths():
            try:
                a.ingest_extra(extra, repo)
            except Exception as e:  # noqa: BLE001
                repo.record_parse_error(
                    {
                        "file": str(extra),
                        "byte_offset": -1,
                        "reason": f"[history] {e}",
                        "raw_line_truncated": "",
                    }
                )

    with handle._lock:
        handle._foreground_complete = True
    handle._foreground_done.set()

    # Phase 2 (background) — older files + missing-data backfill.
    def _background() -> None:
        for adapter, file in older:
            try:
                ingest_file(adapter, file, repo, table)
            except Exception as e:  # noqa: BLE001
                repo.record_parse_error(
                    {
                        "file": str(file),
                        "byte_offset": -1,
                        "reason": f"[ingest] {e}",
                        "raw_line_truncated": "",
                    }
                )
            handle._inc()
        _backfill_missing_derived_data(adapters, repo, table)
        handle._backfill_done.set()

    threading.Thread(target=_background, name="argus-firstrun-bg", daemon=True).start()
    return handle


def _backfill_missing_derived_data(
    adapters: list[Adapter], repo: Repository, table: PricingTable
) -> None:
    """Re-ingest sessions missing tool_calls / segments after a slice upgrade."""
    missing_tools = repo.sessions_missing_tool_calls(200)
    ids: set[str] = {c["id"] for c in missing_tools}
    if repo.is_search_indexing_enabled():
        for c in repo.sessions_missing_segments(200):
            ids.add(c["id"])
    candidates = sorted(ids)[:200]
    if not candidates:
        return

    # session_id "claude_code:<basename>" → file path lookup.
    file_by_basename: dict[str, tuple[Adapter, Path]] = {}
    for a in adapters:
        for f in a.discover_session_files():
            file_by_basename[f.stem] = (a, f)

    for id_ in candidates:
        if "/" in id_:  # sub-agent rollup ids — walked via parents
            continue
        colon = id_.find(":")
        if colon < 0:
            continue
        native = id_[colon + 1 :]
        match = file_by_basename.get(native)
        if match is None:
            continue
        adapter, file = match
        repo.set_file_offset(str(file), 0)
        try:
            ingest_file(adapter, file, repo, table)
        except Exception as e:  # noqa: BLE001
            repo.record_parse_error(
                {
                    "file": str(file),
                    "byte_offset": -1,
                    "reason": f"[backfill-tools] {e}",
                    "raw_line_truncated": "",
                }
            )
