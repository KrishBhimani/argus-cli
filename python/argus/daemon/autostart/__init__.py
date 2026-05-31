"""Platform dispatch for OS autostart registration."""
from __future__ import annotations

import sys
from pathlib import Path


def _backend():
    if sys.platform.startswith("linux"):
        from . import linux

        return linux
    if sys.platform == "darwin":
        from . import macos

        return macos
    if sys.platform.startswith("win"):
        from . import windows

        return windows
    raise RuntimeError(f"Autostart not supported on platform: {sys.platform}")


def install_autostart(data_dir: Path, *, start_now: bool = True) -> str:
    return _backend().install(data_dir, start_now=start_now)


def uninstall_autostart(data_dir: Path) -> str:
    return _backend().uninstall(data_dir)


def autostart_present() -> bool:
    return _backend().is_present()


def linger_hint() -> str:
    return _backend().linger_hint()
