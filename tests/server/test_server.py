"""Server bootstrap — API + static dashboard served from the same app."""
from __future__ import annotations

import signal
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.server import app as appmod
from argus.server.app import ServerOpts, build_app, serve_blocking


def test_app_serves_api_and_static_from_same_root(repo, tmp_path: Path):
    dist = tmp_path / "dashboard-dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html><body>OK</body></html>", encoding="utf-8")

    app = build_app(
        repo,
        ServerOpts(
            pricing_table_version="v1",
            ingest_status=lambda: IngestStatus(
                foreground_complete=True, pending=0, processed=0, total=0
            ),
            dashboard_dir=dist,
            port=0,
            adapters=[],
            pricing_table=PricingTable(version="v1", models={}),
        ),
    )
    client = TestClient(app)

    # Static index serves from "/".
    r = client.get("/")
    assert r.status_code == 200
    assert "OK" in r.text

    # API still serves under /api/.
    r = client.get("/api/sessions")
    assert r.status_code == 200
    assert "sessions" in r.json()


def test_cross_origin_post_is_rejected(repo, tmp_path: Path):
    dist = tmp_path / "dashboard-dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html/>", encoding="utf-8")
    app = build_app(
        repo,
        ServerOpts(
            pricing_table_version="v1",
            ingest_status=lambda: IngestStatus(
                foreground_complete=True, pending=0, processed=0, total=0
            ),
            dashboard_dir=dist,
            port=0,
            adapters=[],
            pricing_table=PricingTable(version="v1", models={}),
        ),
    )
    client = TestClient(app)

    # Cross-origin POST with attacker-controlled Origin -> 403.
    r = client.post(
        "/api/search-index/disable",
        headers={"origin": "http://evil.example.com"},
    )
    assert r.status_code == 403
    assert "cross-origin" in r.json()["error"]


def test_same_origin_post_is_allowed(repo, tmp_path: Path):
    dist = tmp_path / "dashboard-dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html/>", encoding="utf-8")
    app = build_app(
        repo,
        ServerOpts(
            pricing_table_version="v1",
            ingest_status=lambda: IngestStatus(
                foreground_complete=True, pending=0, processed=0, total=0
            ),
            dashboard_dir=dist,
            port=0,
            adapters=[],
            pricing_table=PricingTable(version="v1", models={}),
        ),
    )
    client = TestClient(app)

    r = client.post(
        "/api/search-index/disable",
        headers={"origin": "http://localhost:4242"},
    )
    assert r.status_code == 200
    assert r.json() == {"enabled": False}


def test_cross_origin_post_to_alerts_seen_is_rejected(repo, tmp_path: Path):
    """POST /api/alerts/{id}/seen must enforce the same CSRF origin check."""
    from tests.conftest import alert_factory

    rid = repo.upsert_alert(alert_factory(severity="critical"))
    dist = tmp_path / "dashboard-dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html/>", encoding="utf-8")
    app = build_app(
        repo,
        ServerOpts(
            pricing_table_version="v1",
            ingest_status=lambda: IngestStatus(
                foreground_complete=True, pending=0, processed=0, total=0
            ),
            dashboard_dir=dist,
            port=0,
            adapters=[],
            pricing_table=PricingTable(version="v1", models={}),
        ),
    )
    client = TestClient(app)
    r = client.post(
        f"/api/alerts/{rid}/seen",
        headers={"origin": "http://evil.example.com"},
    )
    assert r.status_code == 403


def test_serve_blocking_ctrl_c_shuts_down_without_traceback(monkeypatch):
    """Ctrl+C must shut the server down cleanly, not dump the uvicorn
    KeyboardInterrupt/CancelledError traceback.

    Two facts make that happen, both asserted here against a fake ``run()`` that
    stands in for the real serve loop:

      1. By the time uvicorn's loop is running, the SIGINT handler is *ours*,
         not ``signal.default_int_handler`` -- so ``asyncio.run()``'s Runner
         declines to install the handler that raises ``KeyboardInterrupt``.
      2. A SIGINT delivered to our handler (including the re-raise uvicorn's
         ``capture_signals`` performs on exit) sets ``should_exit`` /
         ``force_exit`` instead of raising.

    It also pins the cleanup contract: prior signal handlers are restored.
    """
    seen: dict[str, object] = {}

    def fake_run(self) -> None:
        active = signal.getsignal(signal.SIGINT)
        seen["sigint_is_ours"] = active is not signal.default_int_handler
        # First Ctrl+C -> graceful shutdown requested.
        active(signal.SIGINT, None)
        seen["should_exit"] = self.should_exit
        # Second Ctrl+C -> force exit (the path that produced the original
        # traceback at runners.py:157 `raise KeyboardInterrupt()`).
        active(signal.SIGINT, None)
        seen["force_exit"] = self.force_exit
        # uvicorn's capture_signals re-raises the captured signal on exit; with
        # our handler installed this must be a no-op, not a KeyboardInterrupt.
        signal.raise_signal(signal.SIGINT)

    monkeypatch.setattr(appmod.uvicorn.Server, "run", fake_run)

    before = signal.getsignal(signal.SIGINT)
    serve_blocking(FastAPI(), host="127.0.0.1", port=0)  # must not raise
    after = signal.getsignal(signal.SIGINT)

    assert seen["sigint_is_ours"] is True
    assert seen["should_exit"] is True
    assert seen["force_exit"] is True
    assert after is before  # handlers restored on exit
