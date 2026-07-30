"""CoreRuntime — shared watcher+scheduler+first-pass lifecycle.

The regression test is the safety net for the refactor: it asserts that
read_only=False (no daemon) wires the SAME work the old inline
cli.py:start() did — same paths watched, first-pass runs, scheduler ticks,
shutdown order preserved.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from argus.adapters.claude_code.adapter import ClaudeCodeAdapter
from argus.core.runtime import CoreRuntime, NoAdaptersError


def _line(sid: str, uid: str, mid: str) -> str:
    return json.dumps(
        {
            "type": "assistant",
            "sessionId": sid,
            "uuid": uid,
            "timestamp": "2026-05-01T00:00:00Z",
            "cwd": "C:/proj",
            "version": "2.1.94",
            "userType": "external",
            "entrypoint": "cli",
            "message": {
                "id": mid,
                "model": "claude-opus-4-7",
                "role": "assistant",
                "content": [],
                "usage": {
                    "input_tokens": 1,
                    "output_tokens": 1,
                    "cache_read_input_tokens": 0,
                    "cache_creation_input_tokens": 0,
                },
            },
        }
    )


@pytest.fixture
def claude_root(tmp_path: Path) -> Path:
    root = tmp_path / ".claude"
    proj = root / "projects" / "C--proj"
    proj.mkdir(parents=True)
    (proj / "s1.jsonl").write_text(_line("s1", "u1", "m1") + "\n", encoding="utf-8")
    return root


@pytest.fixture
def patched_adapters(monkeypatch, claude_root: Path):
    """Point available_adapters() at a tmp ~/.claude so tests are hermetic."""
    adapter = ClaudeCodeAdapter(claude_root)
    monkeypatch.setattr(
        "argus.core.runtime.available_adapters", lambda: [adapter]
    )
    return adapter


def test_start_read_write_ingests_and_wires_threads(
    tmp_path, patched_adapters
):
    rt = CoreRuntime(tmp_path, read_only=False)
    rt.start()
    try:
        # First-pass foreground ingest ran: the recent session is in the DB.
        turns = rt.repo.get_turns_for_session("claude_code:s1")
        assert len(turns) == 1
        # Watcher + scheduler threads are live.
        assert rt._watcher is not None
        assert rt._scheduler is not None
        # ingest_status delegates to the real first-run handle.
        assert rt.ingest_status().foreground_complete is True
    finally:
        rt.stop()


def test_start_raises_when_no_adapters(tmp_path, monkeypatch):
    monkeypatch.setattr("argus.core.runtime.available_adapters", lambda: [])
    rt = CoreRuntime(tmp_path, read_only=False)
    with pytest.raises(NoAdaptersError):
        rt.start()


def test_start_tolerates_no_adapters_when_not_required(tmp_path, monkeypatch):
    """argusd path: missing ~/.claude must not be fatal — idle, don't crash."""
    monkeypatch.setattr("argus.core.runtime.available_adapters", lambda: [])
    rt = CoreRuntime(tmp_path, read_only=False, require_adapters=False)
    rt.start()  # must not raise
    try:
        assert rt.adapters == []
        # Nothing to ingest yet, so no first-pass / watcher / scheduler...
        assert rt._first_run is None
        assert rt._watcher is None
        assert rt._scheduler is None
        # ...but the DB is open and the runtime is waiting for adapters.
        assert rt.repo is not None
        assert rt._adapter_wait is not None and rt._adapter_wait.is_alive()
    finally:
        rt.stop()
    assert rt._adapter_wait is None


def test_ingestion_starts_when_adapters_appear_later(
    tmp_path, monkeypatch, claude_root
):
    """The waiting runtime picks up ~/.claude once it shows up."""
    adapter = ClaudeCodeAdapter(claude_root)
    present: list[list[ClaudeCodeAdapter]] = [[]]
    monkeypatch.setattr(
        "argus.core.runtime.available_adapters", lambda: list(present[0])
    )

    rt = CoreRuntime(
        tmp_path, read_only=False, require_adapters=False, adapter_poll_sec=0.01
    )
    rt.start()
    try:
        assert rt._watcher is None  # nothing yet

        present[0] = [adapter]  # ~/.claude appears
        for _ in range(500):
            if rt._scheduler is not None:
                break
            time.sleep(0.01)

        assert rt.adapters == [adapter]
        assert rt._watcher is not None
        assert rt._scheduler is not None
        turns = rt.repo.get_turns_for_session("claude_code:s1")
        assert len(turns) == 1
    finally:
        rt.stop()


def test_failed_bring_up_rolls_back_and_retries(tmp_path, monkeypatch, claude_root):
    """A transient failure must not leave the daemon permanently blind."""
    import argus.core.runtime as runtime_mod

    adapter = ClaudeCodeAdapter(claude_root)
    present: list[list[ClaudeCodeAdapter]] = [[]]
    monkeypatch.setattr(
        "argus.core.runtime.available_adapters", lambda: list(present[0])
    )

    real_first_pass = runtime_mod.run_first_pass_ingest
    calls: list[int] = []

    def flaky(*a, **k):
        calls.append(1)
        if len(calls) == 1:
            raise OSError("transient — disk hiccup")
        return real_first_pass(*a, **k)

    monkeypatch.setattr(runtime_mod, "run_first_pass_ingest", flaky)

    rt = CoreRuntime(
        tmp_path, read_only=False, require_adapters=False, adapter_poll_sec=0.01
    )
    rt.start()
    try:
        present[0] = [adapter]
        for _ in range(500):
            if rt._scheduler is not None:
                break
            time.sleep(0.01)
        assert len(calls) >= 2  # first attempt failed, a later one succeeded
        assert rt._watcher is not None
        assert rt._scheduler is not None
    finally:
        rt.stop()


def test_start_after_stop_reuses_the_runtime(tmp_path, patched_adapters):
    """stop() must not leave flags set that neuter a subsequent start()."""
    rt = CoreRuntime(tmp_path, read_only=False, require_adapters=False)
    rt.start()
    rt.stop()
    rt.start()
    try:
        assert rt._watcher is not None
        assert rt._scheduler is not None
    finally:
        rt.stop()


def test_stop_while_waiting_for_adapters_is_clean(tmp_path, monkeypatch):
    monkeypatch.setattr("argus.core.runtime.available_adapters", lambda: [])
    rt = CoreRuntime(
        tmp_path, read_only=False, require_adapters=False, adapter_poll_sec=0.01
    )
    rt.start()
    rt.stop()
    rt.stop()  # idempotent
    assert rt._adapter_wait is None


def test_stop_order_scheduler_then_watcher_then_db(tmp_path, patched_adapters):
    """Shutdown order must match the old inline finally-block:
    scheduler.stop() -> watcher.stop() -> db.close()."""
    rt = CoreRuntime(tmp_path, read_only=False)
    rt.start()

    calls: list[str] = []
    sched = rt._scheduler
    watch = rt._watcher
    orig_sched_stop = sched.stop
    orig_watch_stop = watch.stop

    def sched_stop():
        calls.append("scheduler")
        orig_sched_stop()

    def watch_stop():
        calls.append("watcher")
        orig_watch_stop()

    # sqlite3.Connection.close is a read-only C attribute; wrap it in a proxy
    # that records the call and delegates to the real connection.
    class _DBProxy:
        def __init__(self, real):
            self._real = real

        def close(self):
            calls.append("db")
            self._real.close()

    sched.stop = sched_stop  # type: ignore[method-assign]
    watch.stop = watch_stop  # type: ignore[method-assign]
    rt._db = _DBProxy(rt._db)

    rt.stop()
    assert calls == ["scheduler", "watcher", "db"]


def test_scheduler_uses_default_600s_interval(tmp_path, patched_adapters, monkeypatch):
    """Regression: scheduler must be started with the same 600s cadence."""
    seen: dict[str, int] = {}
    import argus.core.runtime as runtime_mod

    real_start_scheduler = runtime_mod.start_scheduler

    def spy(detectors, repo, *, interval_sec=600):
        seen["interval"] = interval_sec
        return real_start_scheduler(detectors, repo, interval_sec=interval_sec)

    monkeypatch.setattr(runtime_mod, "start_scheduler", spy)
    rt = CoreRuntime(tmp_path, read_only=False)
    rt.start()
    try:
        assert seen["interval"] == 600
    finally:
        rt.stop()


def test_stop_is_idempotent(tmp_path, patched_adapters):
    rt = CoreRuntime(tmp_path, read_only=False)
    rt.start()
    rt.stop()
    rt.stop()  # must not raise


def test_read_only_skips_ingestion_and_blocks_writes(tmp_path, patched_adapters):
    # Seed the DB read-write first (a live daemon would have done this).
    seed = CoreRuntime(tmp_path, read_only=False)
    seed.start()
    seed.stop()

    rt = CoreRuntime(tmp_path, read_only=True)
    rt.start()
    try:
        # No ingestion subsystems started.
        assert rt._first_run is None
        assert rt._watcher is None
        assert rt._scheduler is None
        # Static completed status.
        st = rt.ingest_status()
        assert st.foreground_complete is True
        assert st.processed == 0 and st.total == 0
        # The connection is genuinely read-only.
        import sqlite3

        with pytest.raises(sqlite3.OperationalError):
            rt.repo.set_search_indexing_enabled(True)
    finally:
        rt.stop()
