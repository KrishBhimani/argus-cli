# Argus architecture

A guide to how the pieces fit together, aimed at anyone about to change
the code. Read this before adding a feature so you know where things
live and why. README.md is the user-facing intro; this is the
contributor's map.

## The 30-second mental model

Claude Code writes a `.jsonl` file every time you use it, one file per
session, at `~/.claude/projects/<project>/<session-id>.jsonl`. Each
line is one event: a user message, an assistant reply, a tool call, or
a tool result.

Argus is two things:

1. A **watcher** that reads those files as they grow, validates each
   line, and stores it in a local SQLite database at
   `~/.argus/argus.db`.
2. A **local web server** that queries SQLite and serves a static
   dashboard at `http://localhost:4242`.

No network calls (except optional `argus pricing refresh`). No
telemetry. No LLM calls. Everything stays on your machine.

## The data layer

SQLite in WAL mode. Two tables you'll touch most often:

### `sessions`
One row per session. **Pre-summed totals** for fast listing:

- `id` (e.g. `claude_code:abc123…`), `agent`, `project_path`
- `started_at`, `ended_at`, `duration_sec`
- `total_*_tokens` (fresh_input, output, cache_read, cache_write)
- `total_cost_usd`, `primary_model`, `turn_count`

Use for: the Sessions table, "Top sessions in window" lists, anything
that needs a whole-session view.

### `turns`
One row per back-and-forth with Claude — **the source of truth** for
everything else.

- `id`, `session_id`, `sequence`, `timestamp`
- `model`, `model_raw`
- Per-turn token counts (fresh_input, output, cache_read,
  cache_write_5m, cache_write_1h)
- `tool_calls_count`, `cost_usd`, `metadata`

Use for: anything that needs **per-day** granularity — Overview
heatmap, Trends line chart, "Last N days" totals.

> ⚠️ **Critical rule for windowed views.** Query `turns` by their
> `timestamp`, not `sessions` by `started_at`. A session that started
> 3 weeks ago but had turns this week must still count toward "last 7
> days". The canonical helper is
> `Repository.aggregateTurnsByDay(cutoffIso)`.

### Other tables
- `tool_calls` — one row per tool invocation; powers the Tools page
- `prompts`, `transcript_segments` (+ FTS5 siblings) — opt-in full-text
  search indexes
- `file_offsets` — per-file ingest cursor so we re-read only new bytes
- `parse_errors` — surfaced on Settings → Parse errors
- `app_meta` — schema version, search-indexing flag

## The write path (ingest)

```
~/.claude/projects/<proj>/<session-id>.jsonl
        │
        │  chokidar watches add/change events
        ▼
src/adapters/claude_code/             parse one line at a time
        │
        │  zod schema validates each line
        ▼
src/collector/pipeline.ts             convert to sessions/turns/tool_calls
        │
        ▼
src/store/repository.ts               upsert into SQLite (idempotent — re-ingest is safe)
        │
        ▼
~/.argus/argus.db
```

Two ingest paths share the same `ingestFile` function:

1. **First run** (`src/collector/first_run.ts`) — at startup, walks
   every file. Recent files first (foreground), older files in
   background. Dashboard becomes useful within a few seconds.
2. **Watcher** (`src/collector/watcher.ts`) — keeps running after
   first-run, picks up new lines as Claude Code writes them.

## The read path (server + dashboard)

```
browser → http://localhost:4242
        │
        ▼
src/server/server.ts          hono HTTP server, binds 127.0.0.1 by default
        │
        ▼
src/server/api.ts             /api/overview, /api/sessions, /api/tools, …
        │
        ▼
src/store/repository.ts       parameterized SQL queries
        │
        ▼
dashboard-dist/               static HTML+JS bundled from dashboard/src/ (Astro + ECharts)
```

The dashboard is **statically built**. No server-side rendering, no
Node in the browser. Pages just `fetch('/api/...')` and render with
ECharts.

## Conventions that matter

A few patterns to absorb before adding code:

- **Cutoff-string aggregation.** Windowed queries take an ISO
  timestamp string and use `WHERE timestamp >= ?`. Pass `''` for
  "all time" (empty string sorts below every real ISO string).
  Examples: `aggregateTurnsByDay`, `toolCallsTotal`, `mcpToolCalls`.

- **Top-level vs sub-agent ids.** Sub-agent rollup sessions contain
  `/` in their `id`. SQL excludes them with
  `session_id NOT LIKE '%/%'`; JS excludes them with the
  `isTopLevel(id)` helper. Sub-agent token usage is rolled into the
  parent's totals during ingest, so excluding them at read time
  prevents double-counting.

- **Migrations are append-only.** Never edit a published migration in
  `src/store/migrations/inline.ts`. Add a new `MIGRATION_N+1` and
  bump the schema version check in `db.ts`. Production users have
  data that depends on the exact SQL that already ran.

- **Idempotent ingest.** `upsertTurn`, `upsertSession`, etc. all use
  `ON CONFLICT(id) DO UPDATE`. Re-ingesting a file from offset 0 is
  safe — useful for backfilling derived data after a schema change.

- **HTML-escape every user-controlled string.** Anything from the
  JSONL that ends up in `innerHTML` goes through `escapeHtml()` from
  `dashboard/src/scripts/format.ts`. The only HTML allowed through
  raw is `<mark>` from FTS5 snippets, via `safeSnippet()`.

- **CSRF Origin check.** All non-GET `/api/*` routes verify the
  `Origin` header is loopback. Defends against random tabs in your
  browser hitting argus while it's running.

- **Path safety.** `discoverSessionFiles` realpath-canonicalises each
  candidate and rejects anything outside `~/.claude/` — defends
  against a hostile symlink planted in `projects/`. Use async
  `realpath` not `realpathSync` (the two disagree on Windows
  short-name paths; see commit 43f28c2 for the saga).

## Where things live

```
src/
  cli.ts                    argus start / search / pricing / wipe
  adapters/claude_code/     JSONL parsers, discovery, history.jsonl
  collector/                pipeline, watcher, first-run, backfills
  pricing/                  LiteLLM-derived cost compute
  store/                    SQLite repository + migrations
  server/                   hono routes (api.ts) + serve dashboard
  schema/                   shared TypeScript types

dashboard/
  src/
    layouts/Default.astro   nav, footer, font, styles
    pages/                  one .astro per route
    scripts/                api client, charts, formatters
    styles/global.css       single theme stylesheet
dashboard-dist/             built dashboard, shipped in the npm tarball

pricing/                    bundled LiteLLM price tables (shipped)
~/.argus/argus.db           SQLite DB (created on first run)
~/.claude/                  source data we read from
```

## What's deliberately NOT here

- **No embeddings, no vector DB.** Search is SQLite FTS5 — inverted
  index, BM25 ranking, sub-millisecond, fully offline.
- **No external APIs** except the optional `argus pricing refresh`
  (single HTTP GET to LiteLLM's GitHub).
- **No background workers or message queues.** It's just the file
  watcher and an HTTP server.
- **No auth.** Loopback binding is the security model — see
  [SECURITY.md](./SECURITY.md).

## Common changes and where to start

| Want to… | Touch these |
|---|---|
| Add a new dashboard page | `dashboard/src/pages/<name>.astro`, add nav link in `dashboard/src/layouts/Default.astro` |
| Add a new API endpoint | `src/server/api.ts`, add a `repo.<methodName>()` in `src/store/repository.ts` |
| Add a new SQL table or column | New `MIGRATION_N+1` in `src/store/migrations/inline.ts`, bump schema check in `db.ts`, add `repo` method, add type in `src/schema/types.ts` |
| Parse a new JSONL field | `src/adapters/claude_code/schemas.ts` (zod), wire into `pipeline.ts` |
| Tweak cost computation | `src/pricing/compute.ts`, then re-ingest to recompute via a backfill |
| Add a new chart | `dashboard/src/scripts/charts.ts` (theme is shared) |
