"""The aggregate endpoints are memoised per argument set and invalidated when
the underlying tables change (fingerprint of row counts / max rowids)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from argus.collector.first_run import IngestStatus
from argus.pricing.types import PricingTable
from argus.server.api import _ReadCache
from argus.server.app import ServerOpts, build_app
from tests.conftest import session_factory, turn_factory

LOOPBACK = "http://127.0.0.1"


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def _client(repo, tmp_path: Path) -> TestClient:
    app = build_app(
        repo,
        ServerOpts(
            pricing_table_version="v1",
            ingest_status=lambda: IngestStatus(
                foreground_complete=True, pending=0, processed=0, total=0
            ),
            dashboard_dir=tmp_path / "absent",
            port=0,
            adapters=[],
            pricing_table=PricingTable(version="v1", models={}),
        ),
    )
    return TestClient(app, base_url=LOOPBACK)


def test_overview_is_cached_until_data_changes(repo, tmp_path: Path):
    client = _client(repo, tmp_path)
    recent = _iso(datetime.now(timezone.utc) - timedelta(days=1))
    repo.upsert_session(session_factory("a", recent))
    repo.upsert_turn(turn_factory("a-t1", "a", recent))
    first = client.get("/api/overview?window=7d").json()
    assert first["session_count"] == 1
    # Same fingerprint -> identical answer served from the cache.
    assert client.get("/api/overview?window=7d").json() == first

    # New ingest (a turn row) moves the fingerprint -> recomputed.
    repo.upsert_session(session_factory("b", recent))
    repo.upsert_turn(turn_factory("b-t1", "b", recent))
    assert client.get("/api/overview?window=7d").json()["session_count"] == 2


def test_cache_is_keyed_per_argument(repo, tmp_path: Path):
    client = _client(repo, tmp_path)
    recent = _iso(datetime.now(timezone.utc) - timedelta(days=1))
    repo.upsert_session(session_factory("a", recent))
    repo.upsert_turn(turn_factory("a-t1", "a", recent))
    assert client.get("/api/overview?window=7d").json()["window"] == "7d"
    # A different window must not reuse the 7d entry.
    assert client.get("/api/overview?window=today").json()["window"] == "today"
    assert client.get("/api/trends?granularity=day&groupBy=model").json()["granularity"] == "day"
    assert client.get("/api/trends?granularity=week&groupBy=model").json()["granularity"] == "week"


def test_read_cache_recomputes_only_when_fingerprint_moves(repo):
    cache = _ReadCache(repo)
    calls = []
    assert cache.get(("k",), lambda: calls.append(1) or "v1") == "v1"
    assert cache.get(("k",), lambda: calls.append(1) or "v2") == "v1"  # served from cache
    assert len(calls) == 1
    recent = _iso(datetime.now(timezone.utc))
    repo.upsert_session(session_factory("a", recent))
    assert cache.get(("k",), lambda: calls.append(1) or "v3") == "v3"
    assert len(calls) == 2
