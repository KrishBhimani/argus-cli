"""Server bootstrap — API + static dashboard served from the same app."""
from __future__ import annotations

import signal
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.server import app as appmod
from argus.server.app import ServerOpts, build_app, serve_blocking

# Argus requires a loopback Host header (DNS-rebinding guard in
# server/app.py); TestClient would otherwise send "Host: testserver".
LOOPBACK = "http://127.0.0.1"


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
    client = TestClient(app, base_url=LOOPBACK)

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
    client = TestClient(app, base_url=LOOPBACK)

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
            # Must match the Origin below: the allowlist is now exact, so a
            # port=0 app does not trust :4242.
            port=4242,
            adapters=[],
            pricing_table=PricingTable(version="v1", models={}),
        ),
    )
    client = TestClient(app, base_url=LOOPBACK)

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
    client = TestClient(app, base_url=LOOPBACK)
    r = client.post(
        f"/api/alerts/{rid}/seen",
        headers={"origin": "http://evil.example.com"},
    )
    assert r.status_code == 403


def _host_app(repo, tmp_path: Path, *, host: str = "127.0.0.1", port: int = 4242):
    """Build an app for the Host-header tests (local to this group)."""
    dist = tmp_path / "dashboard-dist"
    dist.mkdir(exist_ok=True)
    (dist / "index.html").write_text("<html/>", encoding="utf-8")
    return build_app(
        repo,
        ServerOpts(
            pricing_table_version="v1",
            ingest_status=lambda: IngestStatus(
                foreground_complete=True, pending=0, processed=0, total=0
            ),
            dashboard_dir=dist,
            port=port,
            adapters=[],
            pricing_table=PricingTable(version="v1", models={}),
            host=host,
        ),
    )


# --- DNS-rebinding guard (docs/SECURITY_AUDIT_2026-07-31.md #1) ---------------
# Regression tests for: a hostile page rebinds its own domain to 127.0.0.1, so
# the browser treats argus as same-origin and SOP no longer blocks reading the
# response. The Origin/CSRF check does not help -- it exempts GET, and every
# data-bearing route is a GET. Only a Host allowlist closes this.


@pytest.mark.parametrize(
    "bad_host",
    [
        "evil.com",
        "evil.com:4242",
        "127.0.0.1.evil.com:4242",  # look-alike prefix
        "localhost.evil.com:4242",  # look-alike prefix
        "attacker.test:4242",
        "",  # HTTP/1.1 requires Host; fail closed
    ],
)
def test_rebound_host_is_rejected_on_get(repo, tmp_path: Path, bad_host: str):
    """A GET carrying a non-loopback Host must not return data."""
    client = TestClient(_host_app(repo, tmp_path), base_url=LOOPBACK)
    r = client.get("/api/export.json", headers={"host": bad_host})
    assert r.status_code == 421, f"Host: {bad_host!r} was served"
    assert "sessions" not in r.text


@pytest.mark.parametrize(
    "good_host", ["127.0.0.1:4242", "localhost:4242", "[::1]:4242", "127.0.0.1", "LocalHost:4242"]
)
def test_loopback_host_is_allowed(repo, tmp_path: Path, good_host: str):
    """The dashboard's own requests must keep working, port-agnostically.

    Any port on loopback is fine: an attacker cannot make a browser send a
    loopback *name* in Host while believing it is same-origin with evil.com,
    and direct fetches to 127.0.0.1 stay unreadable via SOP (no CORS headers).
    """
    client = TestClient(_host_app(repo, tmp_path), base_url=LOOPBACK)
    r = client.get("/api/export.json", headers={"host": good_host})
    assert r.status_code == 200, f"Host: {good_host!r} was rejected"


def test_host_check_is_disabled_when_bound_to_all_interfaces(repo, tmp_path: Path):
    """`--host 0.0.0.0` is a documented, warned opt-out for LAN access.

    Users reach argus by LAN IP or hostname there, which a loopback allowlist
    would reject -- so the guard steps aside rather than breaking the feature.
    """
    app = _host_app(repo, tmp_path, host="0.0.0.0")
    client = TestClient(app, base_url=LOOPBACK)
    r = client.get("/api/export.json", headers={"host": "192.168.1.50:4242"})
    assert r.status_code == 200


def test_rebound_host_is_rejected_on_static_and_search(repo, tmp_path: Path):
    """The guard covers the whole app, not just /api/export.json."""
    client = TestClient(_host_app(repo, tmp_path), base_url=LOOPBACK)
    for path in ("/", "/api/sessions", "/api/search?q=", "/api/prompts"):
        r = client.get(path, headers={"host": "evil.com:4242"})
        assert r.status_code == 421, f"{path} served to a rebound Host"


# --- Origin allowlist breadth (docs/SECURITY_AUDIT_2026-07-31.md #2) ---------
# The Origin check used to accept *any* loopback port, so any other local web
# app -- a `npm run dev` server on :3000 from a cloned repo, a Jupyter kernel,
# anything with a reflected XSS -- could POST /api/search-index/clear and wipe
# transcript segments that per ARCHITECTURE.md may exist nowhere else.


@pytest.mark.parametrize(
    "bad_origin",
    [
        "http://localhost:3000",  # a dev server: the actual regression
        "http://127.0.0.1:8888",  # a notebook
        "http://127.0.0.1:1",
        "https://localhost:4242",  # right port, wrong scheme
        "http://localhost:4242.evil.com",
        "http://evil.example.com",
        None,
    ],
)
def test_other_localhost_ports_cannot_mutate(repo, tmp_path: Path, bad_origin):
    """Only argus's own origin may change state, not all of loopback."""
    client = TestClient(_host_app(repo, tmp_path, port=4242), base_url=LOOPBACK)
    headers = {"host": "127.0.0.1:4242"}
    if bad_origin is not None:
        headers["origin"] = bad_origin
    r = client.post("/api/search-index/clear", headers=headers)
    assert r.status_code == 403, f"Origin {bad_origin!r} was allowed to mutate"


@pytest.mark.parametrize(
    "good_origin",
    ["http://127.0.0.1:4242", "http://localhost:4242", "http://[::1]:4242"],
)
def test_dashboards_own_origin_may_mutate(repo, tmp_path: Path, good_origin: str):
    """However the user reached the dashboard, its own POSTs must work."""
    client = TestClient(_host_app(repo, tmp_path, port=4242), base_url=LOOPBACK)
    r = client.post(
        "/api/search-index/disable",
        headers={"host": "127.0.0.1:4242", "origin": good_origin},
    )
    assert r.status_code == 200, f"Origin {good_origin!r} was rejected"


def test_allowed_origin_tracks_the_configured_port(repo, tmp_path: Path):
    """`argus start --port 9999` must trust :9999 and distrust :4242."""
    client = TestClient(_host_app(repo, tmp_path, port=9999), base_url=LOOPBACK)
    ok = client.post(
        "/api/search-index/disable",
        headers={"host": "127.0.0.1:9999", "origin": "http://127.0.0.1:9999"},
    )
    assert ok.status_code == 200
    bad = client.post(
        "/api/search-index/clear",
        headers={"host": "127.0.0.1:9999", "origin": "http://127.0.0.1:4242"},
    )
    assert bad.status_code == 403


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


def test_safe_staticfiles_swallows_oserror(monkeypatch, tmp_path):
    from starlette.staticfiles import StaticFiles

    from argus.server.app import SafeStaticFiles

    sf = SafeStaticFiles(directory=str(tmp_path))

    def boom(self, path):
        raise OSError(
            123, "The filename, directory name, or volume label syntax is incorrect"
        )

    monkeypatch.setattr(StaticFiles, "lookup_path", boom)
    # Must NOT raise; returns the "not found" sentinel.
    assert sf.lookup_path("api/sessions/claude_code:x/agent-y") == ("", None)


def test_subagent_url_does_not_500(repo, tmp_path: Path):
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
    client = TestClient(app, base_url=LOOPBACK)
    # Unknown sub-agent id: must be a clean 404, never a 500/ASGI crash.
    r = client.get("/api/sessions/claude_code:missing/agent-zzz")
    assert r.status_code == 404
