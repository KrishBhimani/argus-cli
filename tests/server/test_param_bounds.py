"""Caller-supplied numeric params must be bounded.

Regression guard for docs/SECURITY_AUDIT_2026-07-31.md #6. `/api/search` clamped
with ``limit = min(limit, 200)``, which lets a *negative* value straight through
-- and SQLite reads ``LIMIT -1`` as **unlimited**. Any website could therefore
make argus materialise the entire transcript corpus in RAM on a single-worker
uvicorn, wedging ingest and the whole dashboard. The other endpoints had no
clamp at all.

Upper bounds are deliberately generous rather than tidy: the shipped dashboard
really does request ``/api/sessions?limit=100000`` (models.astro:52) and
``limit=10000`` (sessions/index.astro:85). A cap that looked "safe" but broke
those pages would be a worse bug than the one being fixed.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.server.app import ServerOpts, build_app

LOOPBACK = "http://127.0.0.1"


def _client(repo, tmp_path: Path) -> TestClient:
    dist = tmp_path / "dashboard-dist"
    dist.mkdir(exist_ok=True)
    (dist / "index.html").write_text("<html/>", encoding="utf-8")
    app = build_app(
        repo,
        ServerOpts(
            pricing_table_version="v1",
            ingest_status=lambda: IngestStatus(
                foreground_complete=True, pending=0, processed=0, total=0
            ),
            dashboard_dir=dist,
            port=4242,
            adapters=[],
            pricing_table=PricingTable(version="v1", models={}),
        ),
    )
    return TestClient(app, base_url=LOOPBACK)


NEGATIVE_LIMIT_ROUTES = [
    "/api/sessions?limit=-1",
    "/api/sessions?offset=-1",
    "/api/search?q=a&limit=-1",
    "/api/prompts?q=a&limit=-1",
    "/api/alerts?limit=-1",
    "/api/sessions/claude_code:x/transcript?limit=-1",
]


@pytest.mark.parametrize("url", NEGATIVE_LIMIT_ROUTES)
def test_negative_limits_are_rejected(repo, tmp_path: Path, url: str):
    """SQLite treats LIMIT -1 as unlimited, so negatives must never reach it."""
    r = _client(repo, tmp_path).get(url)
    assert r.status_code == 400, f"{url} accepted a negative bound"


@pytest.mark.parametrize(
    "url",
    [
        "/api/sessions?limit=99999999999999999999",  # > 2**63, OverflowError
        "/api/sessions?limit=10000000",
        "/api/alerts?limit=999999",
    ],
)
def test_absurd_upper_bounds_are_rejected_cleanly(repo, tmp_path: Path, url: str):
    """A 400 beats a 500 with a stack trace, and beats a full-corpus scan."""
    r = _client(repo, tmp_path).get(url)
    assert r.status_code == 400, f"{url} -> {r.status_code}"


@pytest.mark.parametrize(
    "url",
    [
        "/api/sessions?limit=100000",  # models.astro:52
        "/api/sessions?limit=10000",  # sessions/index.astro:85
        "/api/search?q=a&limit=200",  # prompts.astro:386
        "/api/alerts?limit=50",  # api.ts:186
        "/api/sessions?limit=0",
    ],
)
def test_the_dashboards_real_requests_still_work(repo, tmp_path: Path, url: str):
    """The bound must not break what the shipped dashboard actually asks for."""
    r = _client(repo, tmp_path).get(url)
    assert r.status_code == 200, f"{url} -> {r.status_code} {r.text[:200]}"


def test_search_still_clamps_large_limits_silently(repo, tmp_path: Path):
    """Within range, an over-large search limit keeps being clamped, not 400'd."""
    r = _client(repo, tmp_path).get("/api/search?q=a&limit=199")
    assert r.status_code == 200
