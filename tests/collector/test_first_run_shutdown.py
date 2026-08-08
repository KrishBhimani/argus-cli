"""First-run's background thread must never outlive the DB connection.

CI caught this as a **segfault** (exit 139), not a test failure: the `db`
fixture called `conn.close()` while `argus-firstrun-bg` was still inside
`upsert_session`. Closing a sqlite3 connection while another thread is using it
is undefined behaviour, so it crashed the whole pytest process — which is why
it showed up as 5-of-9 matrix jobs dying rather than a clean assertion.

`CoreRuntime.stop()` already gets this right (runtime.py:111-116, waits for the
backfill before closing), so production was never affected. The gap was tests
that call `run_first_pass_ingest` directly and let the fixture tear down under
the thread.

The guard therefore lives in the `db` fixture itself — the one place that
closes the connection is the one place that makes sure nobody is still holding
it — so a future test cannot reintroduce this by forgetting.
"""
from __future__ import annotations

import threading
import time

from argus.collector.first_run import FIRST_RUN_THREAD_NAME, join_first_run_threads


def test_join_returns_only_after_the_thread_is_done():
    """The join must actually block, not just poll once and give up."""
    started = threading.Event()
    finished = []

    def slow_work() -> None:
        started.set()
        time.sleep(0.3)
        finished.append(True)

    threading.Thread(target=slow_work, name=FIRST_RUN_THREAD_NAME, daemon=True).start()
    assert started.wait(2), "worker never started"

    alive = join_first_run_threads(timeout=5)

    assert finished == [True], "join returned before the worker finished"
    assert alive == [], f"threads still alive after join: {alive}"


def test_join_reports_threads_that_outlive_the_timeout():
    """A hung backfill must be reported, not silently ignored."""
    release = threading.Event()

    def blocked() -> None:
        release.wait(10)

    t = threading.Thread(target=blocked, name=FIRST_RUN_THREAD_NAME, daemon=True)
    t.start()
    try:
        alive = join_first_run_threads(timeout=0.1)
        assert alive == [FIRST_RUN_THREAD_NAME], f"expected the hung thread, got {alive}"
    finally:
        release.set()
        t.join(5)


def test_join_is_a_no_op_when_nothing_is_running():
    assert join_first_run_threads(timeout=0.1) == []


def test_real_first_run_thread_is_joined(repo, tmp_path, monkeypatch):
    """End to end: a real first-pass ingest leaves no thread behind."""
    from argus.adapters.claude_code.adapter import ClaudeCodeAdapter
    from argus.collector.first_run import run_first_pass_ingest
    from argus.pricing.types import PricingTable

    root = tmp_path / ".claude"
    proj = root / "projects" / "p"
    proj.mkdir(parents=True)
    (proj / "s1.jsonl").write_text(
        '{"type":"user","message":{"role":"user","content":"hi"}}\n', encoding="utf-8"
    )

    handle = run_first_pass_ingest(
        [ClaudeCodeAdapter(root)], repo, PricingTable(version="v1", models={})
    )
    handle.wait_foreground(timeout=10)

    assert join_first_run_threads(timeout=10) == []
    assert not any(
        t.name == FIRST_RUN_THREAD_NAME for t in threading.enumerate()
    ), "a first-run thread survived the join"
