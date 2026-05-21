"""Server bootstrap — API + static dashboard served from the same app."""
from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.server.app import ServerOpts, build_app


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
