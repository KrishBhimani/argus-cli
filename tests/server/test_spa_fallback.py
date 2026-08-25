"""Deep links into the SPA must serve index.html; API and asset misses must stay 404.

The dashboard is a client-routed SPA: ``/sessions/<id>`` exists only in the
browser. ``StaticFiles(html=True)`` serves ``index.html`` at directory roots only,
so a refresh on a deep link 404'd before the fallback in ``server/app.py``.
"""
from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.server.app import ServerOpts, build_app

# Argus requires a loopback Host header (DNS-rebinding guard in server/app.py).
LOOPBACK = "http://127.0.0.1"


def _app(repo, dist: Path):
    return build_app(
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


def _dist(tmp_path: Path, body: str = "<html><body>SPA</body></html>") -> Path:
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(body, encoding="utf-8")
    return dist


def test_unknown_page_path_serves_index(repo, tmp_path: Path):
    client = TestClient(_app(repo, _dist(tmp_path)), base_url=LOOPBACK)
    r = client.get("/sessions/claude_code%3Aabc")
    assert r.status_code == 200
    assert "SPA" in r.text
    assert r.headers["content-type"].startswith("text/html")


def test_nested_and_legacy_paths_serve_index(repo, tmp_path: Path):
    client = TestClient(_app(repo, _dist(tmp_path)), base_url=LOOPBACK)
    assert client.get("/alerts").status_code == 200
    assert client.get("/session?id=claude_code%3Aabc").status_code == 200  # legacy URL, client redirects


def test_api_and_asset_misses_stay_404(repo, tmp_path: Path):
    client = TestClient(_app(repo, _dist(tmp_path)), base_url=LOOPBACK)
    assert client.get("/api/nope").status_code == 404
    # Has an extension: a real asset miss, never the SPA.
    assert client.get("/assets/missing.js").status_code == 404
    assert client.get("/sessions/x.json").status_code == 404


def test_no_dashboard_dir_means_no_fallback(repo, tmp_path: Path):
    client = TestClient(_app(repo, tmp_path / "absent"), base_url=LOOPBACK)
    assert client.get("/sessions/abc").status_code == 404
