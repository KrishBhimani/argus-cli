"""End-to-end smoke: synthetic JSONL → first-pass ingest → API returns it."""
from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from argus.adapters.claude_code.adapter import ClaudeCodeAdapter
from argus.collector.first_run import run_first_pass_ingest
from argus.pricing.load import load_pricing_table
from argus.server.app import ServerOpts, build_app


def test_full_ingest_and_serve_cycle(tmp_path: Path, repo):
    claude_root = tmp_path / ".claude"
    proj = claude_root / "projects" / "C--p"
    proj.mkdir(parents=True)
    (proj / "s.jsonl").write_text(
        json.dumps(
            {
                "type": "assistant",
                "sessionId": "s",
                "uuid": "u",
                "timestamp": "2026-05-22T00:00:00Z",
                "cwd": "C:/p",
                "version": "2.1.94",
                "userType": "external",
                "entrypoint": "cli",
                "message": {
                    "id": "m",
                    "model": "claude-opus-4-7",
                    "role": "assistant",
                    "content": [],
                    "usage": {
                        "input_tokens": 1000,
                        "output_tokens": 2000,
                        "cache_read_input_tokens": 0,
                        "cache_creation_input_tokens": 0,
                    },
                },
            }
        )
        + "\n",
        encoding="utf-8",
    )

    adapter = ClaudeCodeAdapter(claude_root)
    table = load_pricing_table()
    handle = run_first_pass_ingest([adapter], repo, table, recent_days=365)
    handle.wait_foreground(timeout=10)

    dash_dir = tmp_path / "dashboard-dist"
    dash_dir.mkdir()
    (dash_dir / "index.html").write_text("<html/>", encoding="utf-8")

    app = build_app(
        repo,
        ServerOpts(
            pricing_table_version=table.version,
            ingest_status=handle.status,
            dashboard_dir=dash_dir,
            port=0,
            adapters=[adapter],
            pricing_table=table,
        ),
    )
    client = TestClient(app)

    r = client.get("/api/sessions")
    body = r.json()
    assert len(body["sessions"]) == 1
    assert body["sessions"][0]["total_cost_usd"] > 0

    r = client.get("/api/overview?window=all")
    overview = r.json()
    assert overview["total_cost_usd"] > 0
