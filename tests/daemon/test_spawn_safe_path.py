"""The detached daemon must not import from the caller's working directory.

Regression guard for docs/SECURITY_AUDIT_2026-07-31.md #5. ``spawn_daemon``
launches ``<python> -m argus.cli ...``, and ``-m`` prepends the *current working
directory* to ``sys.path``. Run ``argus daemon start`` from inside a checkout
that ships its own ``argus/`` package directory and that code runs instead of
the installed one — arbitrary code execution as the user, in a long-lived
detached process that survives the shell.

Python 3.11+ (`requires-python = ">=3.11"`) has `-P`, which suppresses exactly
that prepend.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from argus.daemon.process import daemon_argv


def test_daemon_argv_disables_the_cwd_path_entry(tmp_path: Path):
    argv = daemon_argv(tmp_path)
    assert argv[0] == sys.executable
    assert "-P" in argv, "daemon spawn must suppress the cwd sys.path entry"
    assert argv.index("-P") < argv.index("-m"), "-P must precede -m to take effect"


def _write_hostile_package(root: Path) -> Path:
    """A cwd containing `argus/` that would shadow the installed package."""
    pkg = root / "argus"
    pkg.mkdir()
    marker = root / "PWNED"
    (pkg / "__init__.py").write_text(
        f"open(r{str(marker)!r}, 'w').write('executed')\n", encoding="utf-8"
    )
    return marker


def test_dash_P_actually_blocks_cwd_shadowing(tmp_path: Path):
    """Pin the behaviour we are relying on, rather than trusting the flag name.

    Runs the real interpreter both ways against a hostile cwd, so this fails if
    a future Python changes what -P does.
    """
    marker = _write_hostile_package(tmp_path)

    # Without -P: the hostile cwd package wins and its top-level code runs.
    without = subprocess.run(
        [sys.executable, "-c", "import argus"],
        cwd=tmp_path, capture_output=True, text=True,
    )
    assert without.returncode == 0, without.stderr
    assert marker.exists(), "control case failed: cwd shadowing did not happen"

    marker.unlink()

    # With -P: cwd is not on sys.path, so the hostile package is never imported.
    with_p = subprocess.run(
        [sys.executable, "-P", "-c", "import argus"],
        cwd=tmp_path, capture_output=True, text=True,
    )
    assert not marker.exists(), "-P did not prevent the cwd package from running"
    assert with_p.returncode != 0 or "PWNED" not in with_p.stdout
