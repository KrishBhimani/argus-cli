"""systemd --user unit for argusd."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

SERVICE_NAME = "argusd"


def unit_path() -> Path:
    return Path.home() / ".config" / "systemd" / "user" / "argusd.service"


def render_unit(data_dir: Path) -> str:
    exec_start = f"{sys.executable} -m argus.cli daemon run --data-dir {data_dir}"
    return (
        "[Unit]\n"
        "Description=Argus background daemon (argusd)\n"
        "\n"
        "[Service]\n"
        f"ExecStart={exec_start}\n"
        "Restart=on-failure\n"
        "\n"
        "[Install]\n"
        "WantedBy=default.target\n"
    )


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
    p = unit_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(render_unit(data_dir), encoding="utf-8")
    _run(["systemctl", "--user", "daemon-reload"])
    enable = ["systemctl", "--user", "enable"]
    enable += ["--now", SERVICE_NAME] if start_now else [SERVICE_NAME]
    _check(_run(enable), "Failed to enable systemd user service")
    return f"Registered systemd user service at {p}"


def uninstall(data_dir: Path) -> str:
    _run(["systemctl", "--user", "disable", "--now", SERVICE_NAME])
    p = unit_path()
    removed = p.exists()
    try:
        p.unlink()
    except FileNotFoundError:
        pass
    _run(["systemctl", "--user", "daemon-reload"])
    return f"Removed systemd user service {p}" if removed else "No systemd unit found."


def is_present() -> bool:
    return unit_path().exists()


def linger_hint() -> str:
    return (
        "Tip: to keep argusd running after you log out, run:\n"
        "    loginctl enable-linger $USER\n"
        "(requires sudo; not run automatically)."
    )
