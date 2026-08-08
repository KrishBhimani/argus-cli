# AGENTS.md — Python backend package (`argus`)

Parent: repo-root `AGENTS.md`. Read it first for the workflow and global rules.

## Purpose

The `argus` package: ingest Claude Code transcripts, store them in SQLite, serve
the dashboard, and provide the `argus` CLI. Runs directly from source
(`uv run argus start`) — no build step. Entry point: `argus = "argus.cli:app"`.

## Ownership

This doc owns backend-wide rules and the subsystems that have no child doc:
- `core/` — runtime wiring (`RuntimeOptions`, building the watcher + server).
- `daemon/` — `argusd` background service: pidfile, process lifecycle, logging.
- `detectors/` — alert detectors (registry + individual rules like tool-error-rate spike).
- `pricing/` — pricing table load / refresh / compute; bundled JSON under repo `pricing/`.
- `scaffold/` — `argus claude` scaffolding (templates, snapshot, storage).
- `schema/` — shared pydantic types (`Session`, `Turn`, …). Changing a stored
  field ripples into `store/` (columns) and `server/` (serialization).

Delegated subtrees (see their own AGENTS.md): `store/`, `collector/`, `adapters/`, `server/`.

## Local Contracts

- **Version lives in two files** that must stay in lock-step: `__init__.py`
  (`__version__`) and repo-root `pyproject.toml`. Bump both on release (root doc).
- **CLI command groups** are Typer apps wired in `cli.py`. When renaming a
  user-facing command, keep the old name as a `hidden=True` alias and nudge to the
  new one (precedent: `search` → `indexing`). Update help strings, the daemon
  read-only API hint, and dashboard copy together.
- **Privacy stays intact:** no network calls or telemetry beyond opt-in
  `argus pricing refresh`. Don't add outbound calls.

## Work Guidance

- Follow existing module patterns; keep files focused and small.
- Python ≥ 3.11. Dependencies are deliberately minimal (fastapi, uvicorn,
  pydantic, watchdog, typer, httpx) — don't add deps without cause.

## Verification

`uv run pytest` (full suite). Subsystem tests live under `tests/<subsystem>/`.

## Child DOX Index

- `store/AGENTS.md` — SQLite, migrations, repository; data-safety + path normalization.
- `collector/AGENTS.md` — ingest pipeline and missing-data backfill.
- `adapters/AGENTS.md` — Claude Code adapter and transcript-segment extraction.
- `server/AGENTS.md` — FastAPI routes, static serving, clean shutdown.
