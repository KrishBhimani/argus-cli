"""Scheduled Task (at logon) for argusd."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

TASK_NAME = "ArgusDaemon"


def create_argv(data_dir: Path) -> list[str]:
    tr = f'"{sys.executable}" -m argus.cli daemon run --data-dir "{data_dir}"'
    return [
        "schtasks",
        "/create",
        "/tn",
        TASK_NAME,
        "/tr",
        tr,
        "/sc",
        "onlogon",
        "/f",
    ]


def _run(args: list[str]):
    return subprocess.run(args, check=False, capture_output=True, text=True)


def _check(result, what: str) -> None:
    """Raise AutostartError if a captured command failed (mocks return None)."""
    if result is not None and getattr(result, "returncode", 0) != 0:
        from . import AutostartError

        detail = (getattr(result, "stderr", "") or "").strip().splitlines()
        hint = detail[0] if detail else "command failed"
        raise AutostartError(f"{what}: {hint}")


def install(data_dir: Path, *, start_now: bool = True) -> str:
    _check(
        _run(create_argv(data_dir)),
        f"Failed to register Scheduled Task '{TASK_NAME}' (may require running "
        "as Administrator)",
    )
    if start_now:
        _run(["schtasks", "/run", "/tn", TASK_NAME])
    return f"Registered Scheduled Task '{TASK_NAME}' (at logon)"


def uninstall(data_dir: Path) -> str:
    _run(["schtasks", "/end", "/tn", TASK_NAME])
    _run(["schtasks", "/delete", "/tn", TASK_NAME, "/f"])
    return f"Removed Scheduled Task '{TASK_NAME}'"


def is_present() -> bool:
    result = subprocess.run(
        ["schtasks", "/query", "/tn", TASK_NAME],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def linger_hint() -> str:
    return ""
