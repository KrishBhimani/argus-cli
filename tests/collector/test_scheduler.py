"""Scheduler — the only writer of alerts. Runs detectors on a fixed cadence."""
from __future__ import annotations

import threading
import time

from argus.collector.scheduler import start_scheduler
from argus.detectors.base import Finding


class _StubDetector:
    name = "stub"

    def __init__(self) -> None:
        self.calls = 0
        self._lock = threading.Lock()

    def detect(self, repo, now_iso: str):
        with self._lock:
            self.calls += 1
        return [
            Finding(
                detector=self.name,
                dedup_key="d1",
                severity="warning",
                title="stub",
                message="stub",
                metadata={},
            )
        ]


class _CrashyDetector:
    name = "crashy"

    def detect(self, repo, now_iso: str):
        raise RuntimeError("boom")


def test_scheduler_runs_detectors_once_on_start(repo):
    det = _StubDetector()
    handle = start_scheduler([det], repo, interval_sec=60)
    try:
        # Wait for the thing we assert on. Polling `det.calls` and then
        # asserting on `alerts` is a race: the detector is invoked before the
        # scheduler upserts its findings, so a loaded runner could observe
        # calls==1 with the alert not yet written (this failed on Windows CI as
        # `assert 0 == 1`). Also budget generously — 1s of polling is a
        # statement about runner speed, not about the scheduler.
        alerts = []
        for _ in range(500):
            alerts = repo.list_alerts(limit=10)
            if alerts:
                break
            time.sleep(0.02)
        assert det.calls == 1
        assert len(alerts) == 1
        assert alerts[0].detector == "stub"
    finally:
        handle.stop()


def test_scheduler_continues_after_detector_crash(repo):
    det_ok = _StubDetector()
    det_bad = _CrashyDetector()
    handle = start_scheduler([det_bad, det_ok], repo, interval_sec=60)
    try:
        for _ in range(50):
            if det_ok.calls >= 1:
                break
            time.sleep(0.02)
        assert det_ok.calls == 1
    finally:
        handle.stop()


def test_scheduler_stop_terminates_thread_quickly(repo):
    handle = start_scheduler([_StubDetector()], repo, interval_sec=60)
    t0 = time.monotonic()
    handle.stop()
    assert time.monotonic() - t0 < 5


class _SwitchableDetector:
    """Detector that emits findings for a controllable set of dedup_keys."""

    name = "switchable"

    def __init__(self) -> None:
        self.next_keys: list[str] = []
        self.calls = 0

    def detect(self, repo, now_iso: str):
        self.calls += 1
        return [
            Finding(
                detector=self.name,
                dedup_key=k,
                severity="warning",
                title=f"{k} is hot",
                message="m",
                metadata={},
            )
            for k in self.next_keys
        ]


def test_scheduler_resolves_keys_that_disappear_between_ticks(repo):
    """Tick 1 emits {Bash, Read}; tick 2 emits {Bash}. Read must get resolved.

    Drives _run_once directly (no daemon thread) so the two ticks are
    strictly ordered — the reconcile behavior is what's under test, not
    the thread scheduling.
    """
    from argus.collector.scheduler import _run_once

    det = _SwitchableDetector()

    det.next_keys = ["Bash", "Read"]
    _run_once([det], repo)
    assert {a.dedup_key for a in repo.list_alerts(limit=10)} == {"Bash", "Read"}

    det.next_keys = ["Bash"]
    _run_once([det], repo)
    keys = {a.dedup_key for a in repo.list_alerts(limit=10)}
    assert keys == {"Bash"}  # Read resolved → filtered out of list_alerts


def test_scheduler_refires_key_after_recovery(repo):
    """Bash spikes, recovers (resolved), then re-spikes → row active again."""
    from argus.collector.scheduler import _run_once

    det = _SwitchableDetector()

    det.next_keys = ["Bash"]
    _run_once([det], repo)
    assert {a.dedup_key for a in repo.list_alerts(limit=10)} == {"Bash"}

    det.next_keys = []  # recovered
    _run_once([det], repo)
    assert repo.list_alerts(limit=10) == []  # resolved, off the card

    det.next_keys = ["Bash"]  # re-spike
    _run_once([det], repo)
    rows = repo.list_alerts(limit=10)
    assert {a.dedup_key for a in rows} == {"Bash"}
    assert rows[0].resolved_at is None
    assert rows[0].seen_at is None  # re-fire → re-pingable
