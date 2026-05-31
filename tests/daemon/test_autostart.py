"""Autostart file generation is pure + testable; service-manager calls mocked."""
from __future__ import annotations

import sys

from argus.daemon.autostart import linux, macos, windows


def test_linux_unit_content(tmp_path):
    unit = linux.render_unit(tmp_path)
    assert "[Unit]" in unit
    assert f"{sys.executable}" in unit
    assert "-m argus.cli daemon run" in unit
    assert "Restart=on-failure" in unit
    assert "WantedBy=default.target" in unit


def test_macos_plist_content(tmp_path):
    plist = macos.render_plist(tmp_path)
    assert "com.argus.daemon" in plist
    assert "<key>KeepAlive</key>" in plist
    assert "<key>SuccessfulExit</key>" in plist  # restart on crash, not clean stop
    assert sys.executable in plist
    assert "argus.cli" in plist


def test_windows_schtasks_argv(tmp_path):
    argv = windows.create_argv(tmp_path)
    assert argv[0] == "schtasks"
    assert "/create" in argv
    assert "/tn" in argv and "ArgusDaemon" in argv
    assert "/sc" in argv and "onlogon" in argv
    joined = " ".join(argv)
    assert "argus.cli" in joined


def test_linux_install_invokes_systemctl(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(linux, "_run", lambda args: calls.append(args))
    monkeypatch.setattr(linux, "unit_path", lambda: tmp_path / "argusd.service")

    linux.install(tmp_path, start_now=True)

    assert (tmp_path / "argusd.service").exists()
    assert ["systemctl", "--user", "daemon-reload"] in calls
    assert ["systemctl", "--user", "enable", "--now", "argusd"] in calls


def test_linux_install_without_start_now_skips_now(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(linux, "_run", lambda args: calls.append(args))
    monkeypatch.setattr(linux, "unit_path", lambda: tmp_path / "argusd.service")

    linux.install(tmp_path, start_now=False)
    assert ["systemctl", "--user", "enable", "argusd"] in calls
    assert ["systemctl", "--user", "enable", "--now", "argusd"] not in calls


def test_linux_uninstall_disables_and_removes(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(linux, "_run", lambda args: calls.append(args))
    unit = tmp_path / "argusd.service"
    unit.write_text("x", encoding="utf-8")
    monkeypatch.setattr(linux, "unit_path", lambda: unit)

    linux.uninstall(tmp_path)
    assert ["systemctl", "--user", "disable", "--now", "argusd"] in calls
    assert not unit.exists()
