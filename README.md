# Argus

**The observability console for Claude Code — local-first, permanent, and honest about cost.**

[![PyPI](https://img.shields.io/pypi/v/argus-code)](https://pypi.org/project/argus-code/)
[![Python ≥ 3.11](https://img.shields.io/badge/python-%E2%89%A5%203.11-blue)](#requirements)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

Claude Code writes a detailed transcript of every session to `~/.claude/` — every turn,
every token, every tool call, every sub-agent it spawned — and then **deletes it after
30 days**. Argus tails those files into a SQLite archive on your machine, prices each
turn from a bundled table, and serves a dashboard at `http://localhost:4242` that
answers the questions the transcripts never do:

- *How much am I actually spending, and is it going up?*
- *Which sessions were expensive — and which turn made them so?*
- *Where do my tools fail, and when did that start?*
- *What did that sub-agent get told, and what did it do?*
- *When do I actually work, and on what?*

Nothing leaves your computer. No telemetry, no API calls, no embeddings — SQLite and
a static web app, bound to `127.0.0.1`.

```sh
pipx install argus-code     # or:  uv tool install argus-code
argus start
```

Your browser opens once the first pass finishes (5–10 s for a typical install). From
then on, every session you run is ingested live.

---

## Why it exists

Tools like `ccusage` read what's on disk *right now*. Claude Code rotates its own
logs (`cleanupPeriodDays`, default 30), so "right now" is a sliding month. Once
Argus has ingested a session into `~/.argus/argus.db` the row stays forever — a few
months in, Argus remembers sessions Claude has already forgotten. **It accumulates.**

And because it keeps the *structure* of each session (turns, tool calls, sub-agents,
cache hits), it can do forensics, not just totals.

---

## What you get

The dashboard is organised by the job you came to do.

### Monitor

| Page | What it answers |
|---|---|
| **Overview** | Four tiles — tokens, estimated cost, sessions, tool error rate — each with its **change vs. the previous window**. A "Needs attention" strip that is always visible (it says *all clear* when there's nothing). Tokens per day, stackable by model. A 90-day activity heatmap and a **weekday × hour** map of when you start sessions. Top sessions in the window. |
| **Alerts** | The inbox for detector findings, with unseen / all / severity filters and a 30-day strip. Today's detector flags any tool whose error rate doubled against its 4-week baseline; more arrive with Budgets. |

### Analyze

| Page | What it answers |
|---|---|
| **Sessions** | A virtualised, sortable grid of every session with inline token bars. Above it, a **duration × tokens scatter** (log–log, coloured by model) that makes outliers obvious, or a per-project rollup. Filter by text, project, model, window. |
| **Session detail** | Tiles, then a **session-shape minimap** — one bar per turn, cache reads beneath fresh tokens, failing turns in red; click a bar to jump. A cumulative-cost line. A compact timeline where every row expands into its tool calls, their sizes, status and output, and error text inline. Resumed sessions are stitched into one chronological thread. |
| **Sub-agents** | For sessions that delegated: a sticky list with an at-a-glance strip (tokens per agent, red where one failed), filter and sort, and ↑↓ stepping. Each agent's **task as given**, tools, shape and full timeline, inline. |
| **Tools** | Leaderboard with error segments, **tool calls per day** (columns / area / table), MCP servers, sub-agent invocations by type. |
| **Models** | Tokens and cost per model, **$ per million tokens** as you actually experienced it, and each model's share over time. |
| **Trends** | Built around **rates, not totals**: this period vs last, a run-rate projection, tokens per session, cache-read share, unit cost — plus the by-model lines, cumulative total and a full breakdown table. |

### Search *(opt-in)*

Full-text search over every prompt you've typed **and** every assistant reply,
thinking block and tool output. SQLite FTS5 — sub-millisecond, lexical,
deterministic, offline. Off by default; see [Privacy](#privacy--security).

### Govern

**Settings** (indexing toggle, pricing version, export, parse errors) today;
**Budgets** — monthly ceilings with threshold alerts — is the next slot.

Every chart follows a few house rules: one axis per chart, a legend whenever there's
more than one series, status colours always paired with an icon and a label, and a
table view behind every chart. Tokens are exact; costs are estimates, and the UI says so.

---

## CLI

```sh
argus                                   # top-level command group
├─ start [--port 4242] [--host 127.0.0.1] [--data-dir <path>]
│                                       # watcher + ingester + dashboard server
├─ pricing
│  └─ refresh                           # pull latest model prices from LiteLLM
├─ indexing                             # (was `search` — still works, hidden alias)
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

`--help` works at every level.

### `argus daemon` — keep ingesting when the dashboard is closed

By default the watcher and detector scheduler run *inside* `argus start`; close it
and ingestion stops. **argusd** moves that work into a long-running background
process. It does not serve the dashboard — port 4242 is still only bound by
`argus start`.

```sh
argus daemon start      # run argusd in the background (survives closing the terminal)
argus daemon status     # PID + uptime
argus daemon logs -f    # follow the log
argus daemon stop
```

**Coexistence.** When argusd is running, `argus start` sees its PID file and becomes a
read-only viewer of the database the daemon keeps fresh (the sidebar footer says
*argusd daemon*). When it isn't, `argus start` ingests in-process exactly as before.

**Living with it.** Idle cost is negligible: the watcher is event-driven and the
scheduler wakes every 10 minutes — expect ~40–70 MB RAM and no idle CPU. Logs rotate
at ~1 MB × 3 in `~/.argus/argusd.log`. Things to know:

- **Restart after upgrading** (`argus daemon restart`) — a running daemon holds the old code.
- **No auto-restart yet.** A crashed daemon stays down until you start it again; the stale PID file is cleaned up. OS-native autostart (`argus install`) is a follow-up.
- **If argusd dies while a read-only dashboard is open**, the footer keeps saying *argusd* and ingestion pauses until you restart the dashboard, which then resumes in-process.
- **Windows `stop` is a hard kill** — safe (no critical in-memory state), but no `argusd stopped.` line lands in the log.
- **Toggling search:** the dashboard's *Enable indexing* button indexes immediately; the CLI `argus indexing enable` flips the flag and backfills on the next `argus start` / `argus daemon restart`.

### `argus claude` — scaffold good agent config

Set things up well *before* you run, not just observe afterwards. `init` copies a
template into a project: `CLAUDE.md` to the root, everything else into `.claude/`.
Existing files are skipped (`--force` overwrites — except `CLAUDE.md`, which is never
overwritten). The bundled `default` template ships a sensible `settings.json`, agents,
commands, rules and a placeholder skill. Save your own project's setup with
`template create`; user templates live in `~/.argus/templates/` and win over bundled ones.

---

## Privacy & security

Argus is built for one person on one machine, and the defaults say so.

- **Binds to `127.0.0.1` only.** Nothing on your LAN, Wi-Fi or VPN can reach it. `--host 0.0.0.0` exists, and prints a loud warning.
- **No external requests, ever** — except `argus pricing refresh`, a manual command that fetches one JSON file from LiteLLM's GitHub. No telemetry, no analytics, no LLM calls.
- **Transcript indexing is opt-in.** Cost and token analytics need no text content. Full-text search over prompts and transcripts requires an explicit opt-in (Settings or `argus indexing enable`), and opting out means the API returns nothing even if data is on disk.
- **Cross-origin writes are rejected.** State-changing endpoints check the `Origin` header against Argus's own origin — exactly — so neither a random tab nor another localhost app can flip your settings.
- **A loopback `Host` header is required.** This defeats DNS rebinding, where a site you visit repoints its domain at `127.0.0.1` to read your history. Anything else gets a 421 (skipped only when you deliberately bind `0.0.0.0`).
- **Transcript text never becomes HTML.** The dashboard renders every transcript-derived string as text; a test forbids raw-HTML sinks in the source.
- **No embeddings, no model weights.** Search is a plain inverted index.

Your data is one file, `~/.argus/argus.db`. `argus wipe` deletes it; so does `rm`.
Vulnerability reports: [SECURITY.md](./SECURITY.md).

---

## How it works

1. **Ingest.** A `watchdog` observer tails `~/.claude/projects/<project>/<session>.jsonl`. Lines are validated with `pydantic`, de-duplicated by `message.id`, and normalised into session / turn rows in SQLite (WAL mode). Resumed sessions and sub-agent files are folded into their parent.
2. **Cost.** Per-turn cost comes from a bundled `pricing/<version>.json` sourced from [LiteLLM](https://github.com/BerriAI/litellm). Tokens are exact; costs are estimates.
3. **Tools.** Each `tool_use` block becomes a `tool_calls` row; errors come from the matching `tool_result`. MCP servers are parsed from `mcp__<server>__<tool>`; the `Agent` tool's `subagent_type` is kept so delegation is visible.
4. **Search (opt-in).** Two FTS5 tables: one over `~/.claude/history.jsonl` (every prompt, ~150 KB for a heavy user), one over assistant text, thinking, user content and tool output (~30–60 MB for hundreds of sessions). Indexed incrementally during the normal ingest tick.
5. **Detection.** A scheduler thread runs registered *detectors* every 10 minutes. Each reads the DB and returns findings; the scheduler upserts them into `alerts` with a seen / resolved lifecycle, so an issue that recovers and recurs fires again instead of staying silent.
6. **Dashboard.** A Vite + React single-page app (uPlot and hand-drawn SVG charts), statically built and served by the FastAPI app. Analyses that aren't in the API yet — prior-window deltas, tokens per session, cache-read share, calls per day — are derived client-side from the existing endpoints. No Node at runtime, no network beyond `/api/*`.
7. **One runtime, two hosts.** The watcher, scheduler and first-pass ingest live in a single `CoreRuntime` that both `argus start` and `argusd` construct, so they can never double-ingest.

Want the deeper tour? [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Configuration

| Where | Knob |
|---|---|
| `argus start --port <n>` | Port (default 4242). |
| `argus start --host <h>` | Bind host (default `127.0.0.1`; `0.0.0.0` for LAN exposure). |
| `argus start --data-dir <path>` | Override `~/.argus/`. |
| `pricing/*.json` | Bundled price tables; refresh with `argus pricing refresh`. |

### Keep more history in Claude Code itself

Claude Code deletes session files after 30 days by default. Raise it in
`~/.claude/settings.json` (minimum 1; it can't be disabled):

```json
{ "cleanupPeriodDays": 365 }
```

Argus keeps its own copy regardless — this only widens what Claude itself retains.

## Requirements

- **Python ≥ 3.11** with an FTS5-enabled `sqlite3` (the standard CPython builds for macOS, Linux and Windows all are; Argus checks at startup and says so clearly if not).
- A `~/.claude/` directory with real session JSONL — i.e. you've used Claude Code at least once.

---

## Development

```sh
git clone https://github.com/KrishBhimani/argus-code.git
cd argus-code
uv sync               # install deps + create venv
uv run pytest         # ~490 tests, ~35 s
uv run argus start    # runs directly from source
```

Dashboard work happens in `dashboard/` (Vite + React): `npm install && npm run dev`
proxies `/api` to a running `argus start`; `npm test`, `npm run build`, `npm run size`
and `npm run e2e` are the gates. The built copy in `dashboard-dist/` ships inside the
wheel, so end users never touch `npm`. See [CONTRIBUTING.md](./CONTRIBUTING.md).

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
dashboard/            React SPA source (Vite)
dashboard-dist/       Vite build output (shipped in wheel as data)
pricing/              Bundled pricing JSON (shipped in wheel as data)
templates/            Bundled .claude/ scaffolding templates (shipped in wheel as data)
tests/                pytest suite, mirrors python/argus/ layout
```

## License

MIT — see [LICENSE](./LICENSE).
