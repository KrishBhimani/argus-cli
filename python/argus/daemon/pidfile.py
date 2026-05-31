"""``~/.argus/argusd.pid`` lifecycle and cross-platform liveness checks.

Liveness uses ``os.kill(pid, 0)`` on POSIX and ``OpenProcess`` +
``GetExitCodeProcess`` (via ctypes) on Windows — no ``tasklist`` subprocess.
A stale PID file (process dead) is treated as "not running" by callers.
"""
from __future__ import annotations

import os
from pathlib import Path

PID_FILENAME = "argusd.pid"


def path(data_dir: Path) -> Path:
    return Path(data_dir) / PID_FILENAME


def write(data_dir: Path, pid: int) -> None:
    p = path(data_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(str(pid), encoding="utf-8")


def read(data_dir: Path) -> int | None:
    p = path(data_dir)
    try:
        text = p.read_text(encoding="utf-8").strip()
    except (FileNotFoundError, OSError):
        return None
    try:
        return int(text)
    except ValueError:
        return None


def remove(data_dir: Path) -> None:
    try:
        path(data_dir).unlink()
    except FileNotFoundError:
        pass


def is_running(pid: int | None) -> bool:
    if pid is None or pid <= 0:
        return False
    if os.name == "nt":
        return _is_running_windows(pid)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # exists but owned by another user
    except OSError:
        return False
    return True


def _is_running_windows(pid: int) -> bool:
    import ctypes
    from ctypes import wintypes

    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    STILL_ACTIVE = 259

    kernel32 = ctypes.windll.kernel32
    handle = kernel32.OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION, False, pid
    )
    if not handle:
        return False
    try:
        code = wintypes.DWORD()
        if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
            return False
        return code.value == STILL_ACTIVE
    finally:
        kernel32.CloseHandle(handle)
