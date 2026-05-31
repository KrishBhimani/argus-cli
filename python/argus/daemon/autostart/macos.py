"""launchd LaunchAgent for argusd."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

LABEL = "com.argus.daemon"


def plist_path() -> Path:
    return Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"


def render_plist(data_dir: Path) -> str:
    # KeepAlive as a dict (SuccessfulExit=false) => restart on crash, NOT on a
    # clean `daemon stop`. Keeps graceful stop from being resurrected.
    args = [
        sys.executable,
        "-m",
        "argus.cli",
        "daemon",
        "run",
        "--data-dir",
        str(data_dir),
    ]
    arg_xml = "\n".join(f"    <string>{a}</string>" for a in args)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
        '"http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n'
        '<plist version="1.0">\n'
        "<dict>\n"
        "  <key>Label</key>\n"
        f"  <string>{LABEL}</string>\n"
        "  <key>ProgramArguments</key>\n"
        "  <array>\n"
        f"{arg_xml}\n"
        "  </array>\n"
        "  <key>KeepAlive</key>\n"
        "  <dict>\n"
        "    <key>SuccessfulExit</key>\n"
        "    <false/>\n"
        "  </dict>\n"
        "  <key>RunAtLoad</key>\n"
        "  <true/>\n"
        "</dict>\n"
        "</plist>\n"
    )


def _run(args: list[str]) -> None:
    subprocess.run(args, check=False)


def install(data_dir: Path, *, start_now: bool = True) -> str:
    p = plist_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(render_plist(data_dir), encoding="utf-8")
    if start_now:
        _run(["launchctl", "load", "-w", str(p)])
    return f"Registered launchd agent at {p}"


def uninstall(data_dir: Path) -> str:
    p = plist_path()
    _run(["launchctl", "unload", "-w", str(p)])
    removed = p.exists()
    try:
        p.unlink()
    except FileNotFoundError:
        pass
    return f"Removed launchd agent {p}" if removed else "No launchd agent found."


def is_present() -> bool:
    return plist_path().exists()


def linger_hint() -> str:
    return ""
