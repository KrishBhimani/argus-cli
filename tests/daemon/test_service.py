"""Foreground daemon entry point: collision guard, PID lifecycle, signals."""
from __future__ import annotations

import threading
import time

import pytest

from argus.daemon import pidfile, service


class _FakeRuntime:
    def __init__(self, *a, **k):
        self.args = a
        self.kwargs = k
        self.started = False
        self.stopped = False

    def start(self):
        self.started = True

    def stop(self):
        self.stopped = True


def test_run_foreground_writes_pid_runs_and_cleans_up(tmp_path, monkeypatch):
    fake = _FakeRuntime()
    monkeypatch.setattr(service, "CoreRuntime", lambda *a, **k: fake)
    stop = threading.Event()

    t = threading.Thread(
        target=service.run_foreground,
        args=(tmp_path,),
        kwargs={"stop_event": stop, "install_signals": False},
        daemon=True,
    )
    t.start()

    # Wait for the PID file to appear.
    for _ in range(100):
        if pidfile.read(tmp_path) is not None:
            break
        time.sleep(0.01)
    assert pidfile.read(tmp_path) is not None
    assert fake.started is True

    stop.set()
    t.join(timeout=3)
    assert fake.stopped is True
    assert pidfile.read(tmp_path) is None  # cleaned up on exit


def test_run_foreground_does_not_require_adapters(tmp_path, monkeypatch):
    """A missing ~/.claude must not kill the service (issue #11)."""
    made: list[_FakeRuntime] = []

    def _factory(*a, **k):
        rt = _FakeRuntime(*a, **k)
        made.append(rt)
        return rt

    monkeypatch.setattr(service, "CoreRuntime", _factory)
    stop = threading.Event()
    stop.set()  # return as soon as the runtime is up

    service.run_foreground(tmp_path, stop_event=stop, install_signals=False)

    assert made[0].kwargs["require_adapters"] is False


def test_run_foreground_refuses_when_live_daemon_exists(tmp_path, monkeypatch):
    pidfile.write(tmp_path, 999999)  # a PID that isn't us
    monkeypatch.setattr(pidfile, "is_running", lambda pid: True)
    monkeypatch.setattr(service, "CoreRuntime", _FakeRuntime)

    with pytest.raises(service.DaemonAlreadyRunning):
        service.run_foreground(
            tmp_path, stop_event=threading.Event(), install_signals=False
        )
