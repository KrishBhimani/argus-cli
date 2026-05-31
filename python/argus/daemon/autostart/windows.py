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


def _run(args: list[str]) -> None:
    subprocess.run(args, check=False)


def install(data_dir: Path, *, start_now: bool = True) -> str:
    _run(create_argv(data_dir))
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
