"""PID file lifecycle + cross-platform liveness."""
from __future__ import annotations

import os

from argus.daemon import pidfile


def test_write_read_remove_roundtrip(tmp_path):
    assert pidfile.read(tmp_path) is None
    pidfile.write(tmp_path, 4242)
    assert pidfile.path(tmp_path).exists()
    assert pidfile.read(tmp_path) == 4242
    pidfile.remove(tmp_path)
    assert pidfile.read(tmp_path) is None


def test_read_returns_none_on_garbage(tmp_path):
    pidfile.path(tmp_path).parent.mkdir(parents=True, exist_ok=True)
    pidfile.path(tmp_path).write_text("not-a-number", encoding="utf-8")
    assert pidfile.read(tmp_path) is None


def test_remove_is_idempotent(tmp_path):
    pidfile.remove(tmp_path)  # no file yet — must not raise
    pidfile.write(tmp_path, 1)
    pidfile.remove(tmp_path)
    pidfile.remove(tmp_path)


def test_is_running_true_for_current_process():
    assert pidfile.is_running(os.getpid()) is True


def test_is_running_false_for_dead_pid():
    # PID 0 / negative are never valid live targets here.
    assert pidfile.is_running(0) is False
    # A very high unlikely-to-exist PID.
    assert pidfile.is_running(2_000_000_000) is False
