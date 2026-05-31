"""argus start chooses read_only based on daemon liveness."""
from __future__ import annotations

from argus.daemon import pidfile


def _decide(data_dir):
    """Mirror of the decision in cli.start(); kept tiny and pure for testing."""
    pid = pidfile.read(data_dir)
    return pid is not None and pidfile.is_running(pid)


def test_live_daemon_forces_read_only(tmp_path, monkeypatch):
    pidfile.write(tmp_path, 12345)
    monkeypatch.setattr(pidfile, "is_running", lambda pid: True)
    assert _decide(tmp_path) is True


def test_stale_pid_is_not_read_only(tmp_path, monkeypatch):
    pidfile.write(tmp_path, 12345)
    monkeypatch.setattr(pidfile, "is_running", lambda pid: False)
    assert _decide(tmp_path) is False


def test_absent_pid_is_not_read_only(tmp_path):
    assert _decide(tmp_path) is False
