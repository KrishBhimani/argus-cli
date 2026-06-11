# Argus

**Local-first analytics + persistent archive for Claude Code.** Argus reads
your `~/.claude/` session logs, computes cost from a bundled pricing table,
and serves a dashboard at `http://localhost:4242` that tells you exactly how,
when, and how much you've been using Claude Code.

Claude Code rotates its own session files (`cleanupPeriodDays` defaults to
30). Once Argus ingests a session into `~/.argus/argus.db`, the row stays
forever — so a few months in, Argus knows about sessions Claude has already
deleted. Live tools like `ccusage` can only show what's currently on disk;
Argus accumulates.

Everything stays on your machine. No telemetry, no API calls, no
embeddings — just SQLite and a static web UI.

```sh
pipx install argus-code     # or:  uv tool install argus-code
argus start
```

That's it. Your default browser opens to the dashboard once the first-pass
ingest finishes (~5–10s for a typical install).

## What it shows you

| Page | What it answers |
|---|---|
| **Overview** | How many tokens have I burned? How much would I have paid on the API? Where does my spend land each day? Plus a **"What needs attention"** card that surfaces detector findings (e.g. a tool whose error rate spiked this week). |
| **Sessions** | Sortable table of every session — project, model, tokens, cost, duration. Click any row to drill in: an **Overview** tab with totals and the turns table, and a **Timeline** tab showing per-turn token burn (chart + trace feed), every tool call, and failures — with the actual error output inline when search indexing is on. |
| **Tools** | Tool-call leaderboard (Bash vs Edit vs Read vs WebFetch…), error rates per tool, MCP server breakdown, sub-agent invocations. |
| **Search** *(opt-in)* | Full-text search over every prompt you've typed AND every assistant response, your replies, and tool output. SQLite FTS5, sub-millisecond, no embeddings. |
| **Trends** | Tokens and cost bucketed by day / week / month, grouped by model. |
| **Models** | Per-model token mix and cost rollup. |
| **Settings** | Search-indexing toggle, pricing version, parse errors, data export. |

## CLI

```sh
argus                                   # top-level command group
├─ start [--port 4242] [--host 127.0.0.1] [--data-dir <path>]
│                                       # watcher + ingester + dashboard server
├─ pricing
│  └─ refresh                           # pull latest model prices from LiteLLM
├─ search
│  ├─ status                            # is transcript indexing on?
│  ├─ enable                            # turn it on (next start backfills)
│  ├─ disable                           # turn it off, keep data
│  └─ clear                             # wipe all indexed segments + disable
├─ claude                               # scaffold & manage .claude/ setups
│  ├─ init [path] [--template <name>] [--force]
│  │                                    # stamp CLAUDE.md + .claude/ into a project
│  └─ template
│     ├─ list                           # list templates (bundled + user)
│     └─ create <name> [--path <dir>] [--all]
│                                       # save a project's .claude/ as a template
├─ daemon                               # argusd — background ingestion + detectors
│  ├─ start                             # start argusd detached, write PID file
│  ├─ stop                              # stop argusd gracefully
│  ├─ restart                           # stop then start
│  ├─ status                            # running? PID + uptime
│  └─ logs [-n N] [-f]                  # tail ~/.argus/argusd.log
└─ wipe                                 # delete ~/.argus/ entirely
```

Run `--help` at any level for details — `argus --help`, `argus claude --help`,
`argus claude template --help`, `argus daemon --help`.

### `argus daemon` — background daemon (argusd)

By default the watcher and the detector scheduler run *inside* `argus start` —
close the dashboard and ingestion stops. `argusd` moves that work into a
long-running background process so your data stays fresh and detectors keep
running whether or not the dashboard is open. It does **not** serve the
dashboard (port 4242 is still only bound by `argus start`).

```sh
argus daemon start      # run argusd in the background
argus daemon status     # PID + uptime
argus daemon logs -f    # follow the log (survives rotation)
argus daemon stop
```

> **Autostart at login is coming separately.** For now, start argusd yourself
> with `argus daemon start` (it survives closing the terminal). OS-native
> autostart (`argus install` / `argus uninstall`) lands in a follow-up.

**Coexistence.** When argusd is running, `argus start` notices its PID file and
becomes a **read-only dashboard** — it skips its own watcher/scheduler and just
views the database the daemon keeps fresh (the footer shows *"Powered by
argusd"*). When argusd is **not** running, `argus start` ingests in-process
exactly as before, so users who never touch the daemon see no change.

> **Known limitation (v1):** if argusd dies while a read-only dashboard is open,
> the footer keeps showing *"Powered by argusd"* and ingestion pauses until you
> restart the dashboard (which then resumes ingesting in-process). The dashboard
> does not re-check daemon liveness on every poll.

**Running it long-term.** argusd is designed to stay up. Its idle cost is
negligible — the watcher is event-driven (sleeps until a `~/.claude` file
changes) and the detector scheduler wakes once every 10 minutes; expect ~40–70
MB RAM and effectively no idle CPU. The log is capped at ~4 MB (1 MB × 3
rotations). A few habits worth knowing:

- **Restart after upgrading argus.** A running daemon holds the old code in
  memory — run `argus daemon restart` after `uv sync` / `pip install -U` to pick
  up changes.
- **No auto-restart yet.** A daemon started with `argus daemon start` that
  crashes stays down until you start it again (the stale PID file is cleaned up
  automatically). OS-supervised restart arrives with autostart in a follow-up.
- **Windows stop is a hard kill.** `argus daemon stop` terminates the process
  directly on Windows, so no `argusd stopped.` line is written to the log (the
  CLI still prints it). This is safe — there's no critical in-memory state.
- **Toggling search:** the dashboard's "Enable indexing" button indexes
  immediately; the CLI `argus search enable` only flips the flag and defers the
  backfill to the next `argus start` / `argus daemon restart`.

Logs live at `~/.argus/argusd.log` (plain text, rotated at ~1 MB × 3).

### `argus claude` — project scaffolding

Set good agent config *before* you run, not just observe it after. `init`
copies a template into a project: `CLAUDE.md` goes to the project root,
everything else into `.claude/`. Existing files are skipped (use `--force`
to overwrite) — but an existing `CLAUDE.md` is **never** overwritten, even
with `--force`. The bundled `default` template ships a sensible
`settings.json`, agents, commands, rules, and a placeholder skill. Save your
own project's setup as a reusable template with `template create`; user
templates live in `~/.argus/templates/` and take precedence over bundled ones.

## Privacy & security

Argus is built for one user on one machine. The defaults reflect that:

- **Server binds to `127.0.0.1` only.** Nothing on your LAN/Wi-Fi/VPN can
  reach the dashboard. Use `argus start --host 0.0.0.0` if you really
  want LAN exposure — it prints a loud warning when you do.
- **No external requests, ever**, except `argus pricing refresh` which
  is a manual command that fetches one JSON file from LiteLLM's GitHub.
  No telemetry, no analytics pings, no LLM calls.
- **Transcript indexing is opt-in.** Cost-and-token analytics work out of
  the box without indexing any text content. Full-text search across
  prompts and transcripts requires explicit opt-in via Settings or
  `argus search enable`. Opting out actually means out — the API
  returns empty results, even if data is on disk.
- **Cross-origin POSTs are rejected.** The state-changing endpoints
  (`/api/search-index/*`) check the `Origin` header so a random tab in
  your browser can't silently wipe your data while argus is running.
- **No embeddings, no model weights.** Search uses SQLite FTS5 — pure
  inverted-index lexical search. Lookups are deterministic and offline.

Data lives at `~/.argus/argus.db`. Delete it any time with `argus wipe`
(or just remove the file).

For vulnerability reports, see [SECURITY.md](./SECURITY.md).

## How it works

1. **Ingest.** A `watchdog` observer tails every `~/.claude/projects/<project>/<session-id>.jsonl`
   file. Lines are validated with `pydantic`, deduplicated by `message.id`,
   and turned into normalized session/turn rows in SQLite (WAL mode).
2. **Cost.** Per-turn cost comes from a bundled `pricing/<version>.json`
   table sourced from [LiteLLM](https://github.com/BerriAI/litellm).
   Tokens are exact; costs are estimates and the dashboard says so.
3. **Tools.** Each `tool_use` block in the JSONL becomes a row in
   `tool_calls`. Errors come from matching `tool_result.is_error` in the
   next user message. MCP servers are extracted from tool names matching
   `mcp__<server>__<tool>`.
4. **Search (opt-in).** Two FTS5 virtual tables: one over `~/.claude/history.jsonl`
   (every prompt you've ever typed, ~150 KB indexed for a heavy user),
   one over assistant text + thinking blocks + user content + tool
   output (~30–60 MB for hundreds of sessions). Indexing happens
   incrementally during the normal ingest tick.
5. **Dashboard.** Astro 5 + ECharts, statically built, served by the
   FastAPI app (uvicorn). No server-side rendering, no Node code in the browser.
6. **Detection (alerts).** A lightweight scheduler thread runs registered
   *detectors* on a fixed cadence. Each detector reads the DB and returns
   findings; the scheduler is the sole writer, upserting them into an
   `alerts` table — idempotent, with a `resolved_at` lifecycle so an issue
   that recovers then recurs fires again instead of staying silent. The
   Overview's "What needs attention" card reads these, and critical findings
   raise a browser notification. The v1 detector flags tools whose error rate
   spiked versus their preceding 4-week baseline.
7. **Shared runtime + daemon.** The watcher, scheduler, and first-pass ingest
   are owned by a single `CoreRuntime` that both `argus start` and `argusd`
   construct. The optional `argusd` daemon (`argus daemon`) runs that runtime in
   its own process; a live daemon flips `argus start`
   into a read-only viewer so the two never double-ingest. See **`argus
   daemon`** above.

## Configuration

| Where | Knob |
|---|---|
| `argus start --port <n>` | Pick a different port (default 4242). |
| `argus start --host <h>` | Bind host (default `127.0.0.1`). Pass `0.0.0.0` for LAN exposure. |
| `argus start --data-dir <path>` | Override `~/.argus/`. |
| `pricing/*.json` | Bundled price tables. Refresh with `argus pricing refresh`. |

## Requirements

- **Python ≥ 3.11.** Argus uses the stdlib `sqlite3` module — make sure
  your Python was built with FTS5 (the standard CPython distributions
  for macOS, Linux, and Windows all are). Argus checks at startup and
  fails with a clear error if FTS5 is missing.
- A `~/.claude/` directory containing real session JSONL — i.e. you've
  used Claude Code at least once. Argus exits with a friendly message
  if it's missing.

## Keep your history longer

By default Claude Code deletes session files after 30 days. To extend the
window, set `cleanupPeriodDays` in `~/.claude/settings.json`:

```json
{
  "cleanupPeriodDays": 365
}
```

The minimum is 1; there's no way to disable cleanup entirely. Whatever you
set, Argus's own database keeps the data even after Claude rotates it out.

## Development

```sh
git clone https://github.com/KrishBhimani/argus-code.git
cd argus-code
uv sync               # install deps + create venv
uv run pytest         # ~245 tests, ~20s
uv run argus start    # dev — runs directly from source
```

The dashboard is an Astro project under `dashboard/` and still builds via
`npm` at release time only. End users never touch npm.

Source layout:

```
python/argus/         Python ingest, store, server, CLI
  adapters/           Claude Code JSONL parsers + adapter registry
  store/              SQLite schema + migrations + repo
  server/             FastAPI app + /api routes
  collector/          watcher + pipeline + first-run + search backfill + alert scheduler
  core/               CoreRuntime — shared watcher+scheduler+ingest lifecycle
  daemon/             argusd: pidfile, foreground service, process control, logging
  detectors/          alert detectors (pure reads) + @register registry
  scaffold/           `argus claude` template storage / init / snapshot
  pricing/            LiteLLM-derived price table + cost compute
  schema/             pydantic data models
dashboard/            Astro source
dashboard-dist/       Astro build output (shipped in wheel as data)
pricing/              Bundled pricing JSON (shipped in wheel as data)
templates/            Bundled .claude/ scaffolding templates (shipped in wheel as data)
tests/                pytest suite, mirrors python/argus/ layout
```

## License

MIT — see [LICENSE](./LICENSE).
