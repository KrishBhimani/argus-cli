# Argus

Local-first dashboard for Claude Code usage and cost. Reads `~/.claude/` session logs, normalizes them, computes cost from a bundled pricing table, and serves a dashboard at `http://localhost:4242`.

## Install

```sh
npm install -g argus-cli
```

## Run

```sh
argus start
```

Opens the dashboard in your browser. First run ingests the last 30 days in the foreground; older history backfills in the background.

## Commands

- `argus start` — boot watcher, ingest, and dashboard
- `argus pricing refresh` — pull latest LiteLLM pricing, diff, apply on confirm
- `argus wipe` — delete `~/.argus/`

## Privacy

Argus reads metadata only — no prompts, responses, or code. Data lives at `~/.argus/argus.db` and stays on your machine. No telemetry.
