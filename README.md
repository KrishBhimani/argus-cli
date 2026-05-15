# Argus

**Local-first analytics for coding agents.** Argus reads your
`~/.claude/` and `~/.openclaw/` session logs, computes cost from a bundled
pricing table (or trusts the agent's reported cost when it has one), and
serves a dashboard at `http://localhost:4242` that tells you exactly how,
when, and how much you've been using your agents. Filter the whole
dashboard by backend, drill into a backend-specific page, or watch the
combined view.

Everything stays on your machine. No telemetry, no API calls, no
embeddings — just SQLite and a static web UI. **The dashboard is one
reference UI over the HTTP API documented in [API.md](./API.md) — swap it
out without touching the backend.**

```sh
npm install -g argus-cli
argus start
```

That's it. Your default browser opens to the dashboard once the first-pass
ingest finishes (~5–10s for a typical install).

## What it shows you

| Page | What it answers |
|---|---|
| **Overview** | How many tokens have I burned? How much would I have paid on the API? Where does my spend land each day? |
| **Sessions** | Sortable table of every session — project, backend (Claude Code / OpenClaw / named OpenClaw agent), model, tokens, cost, duration. Click any row to drill in. |
| **Tools** | Tool-call leaderboard (Bash vs Edit vs Read vs WebFetch…), error rates per tool, MCP server breakdown, sub-agent invocations. |
| **Agents → Claude Code** | Sub-agent (Task tool) delegation breakdown. |
| **Agents → OpenClaw** | Per-named-agent rollup (admin / dev / main / …) and per-provider rollup (kimi / anthropic / openai / …). |
| **Search** *(opt-in)* | Full-text search over every prompt you've typed AND every assistant response, your replies, and tool output. Claude Code only. SQLite FTS5, sub-millisecond, no embeddings. |
| **Trends** | Tokens and cost bucketed by day / week / month, grouped by agent / model / named agent. |
| **Models** | Per-model token mix and cost rollup. |
| **Settings** | Search-indexing toggle, pricing version, parse errors, data export. |

The header has a global `[Agent ▾]` picker — pick **All**, a backend (e.g.
Claude Code, OpenClaw), or a specific OpenClaw named agent. The choice
sticks across pages.

## CLI

```sh
argus start [--port 4242] [--host 127.0.0.1]
argus pricing refresh           # pull latest model prices from LiteLLM
argus search status             # is transcript indexing on?
argus search enable             # turn it on (next start backfills)
argus search disable            # turn it off, keep data
argus search clear              # wipe all indexed segments + disable
argus wipe                      # delete ~/.argus/ entirely
```

`argus start --help` for the full list.

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

1. **Ingest.** A `chokidar` watcher tails every
   `~/.claude/projects/<project>/<session-id>.jsonl` file **and** every
   `~/.openclaw/agents/<name>/sessions/<session-id>.jsonl[.reset.*|.deleted.*]`
   file. Lines are validated with `zod`, deduplicated, and turned into
   normalized session/turn rows in SQLite (WAL mode). Each backend has its
   own adapter under `src/adapters/` — adding a new agent backend means
   dropping a new folder there; see [CONTRIBUTING.md](./CONTRIBUTING.md).
2. **Cost.** For Claude Code, per-turn cost comes from a bundled
   `pricing/<version>.json` table sourced from
   [LiteLLM](https://github.com/BerriAI/litellm). For OpenClaw, cost is
   read verbatim from each turn's embedded `usage.cost.total` (provider-
   billed), and the session row's `pricing_table_version` reads
   `openclaw-reported` to make the source explicit. Tokens are always
   exact; the dashboard labels cost as an estimate.
3. **Tools.** Each `tool_use` block in the JSONL becomes a row in
   `tool_calls`. Errors come from matching `tool_result.is_error` in the
   next user message. MCP servers are extracted from tool names matching
   `mcp__<server>__<tool>`.
4. **Search (opt-in).** Two FTS5 virtual tables: one over `~/.claude/history.jsonl`
   (every prompt you've ever typed, ~150 KB indexed for a heavy user),
   one over assistant text + thinking blocks + user content + tool
   output (~30–60 MB for hundreds of sessions). Indexing happens
   incrementally during the normal ingest tick.
5. **Dashboard.** Astro 5 + ECharts, statically built, served by `hono`.
   No server-side rendering, no Node code in the browser.

## Configuration

| Where | Knob |
|---|---|
| `argus start --port <n>` | Pick a different port (default 4242). |
| `argus start --host <h>` | Bind host (default `127.0.0.1`). Pass `0.0.0.0` for LAN exposure. |
| `argus start --data-dir <path>` | Override `~/.argus/`. |
| `pricing/*.json` | Bundled price tables. Refresh with `argus pricing refresh`. |

## Requirements

- **Node.js ≥ 22.** `better-sqlite3` ships prebuilt binaries for macOS
  (x64 + arm64), Linux (x64 + arm64), and Windows (x64) on Node 22, so
  installation is fast and doesn't require a C++ toolchain on those
  platforms.
- A `~/.claude/` directory OR a `~/.openclaw/` directory containing real
  session JSONL — i.e. you've used at least one supported agent. Argus
  exits with a friendly message if neither is present.

## Development

```sh
git clone https://github.com/KrishBhimani/argus-cli.git
cd argus-cli
npm install
npm test           # 98 tests, ~3s
npm run build      # tsc + astro build
npm run dev        # tsx src/cli.ts start
```

Source layout:

```
src/                  TypeScript ingest, store, server, CLI
src/adapters/         Per-agent JSONL parsers
  registry.ts           loadAdapters() — single entry point
  claude_code/          Claude Code adapter
  openclaw/             OpenClaw adapter
src/store/            SQLite schema + migrations + repo
src/server/           hono API (see API.md for the contract)
src/collector/        watcher + pipeline + first-run + search backfill
src/pricing/          LiteLLM-derived price table + cost compute
dashboard/            Astro source
dashboard-dist/       Astro build output (shipped in npm tarball)
pricing/              Bundled pricing JSON (shipped)
API.md                HTTP API reference — the canonical contract
```

## License

MIT — see [LICENSE](./LICENSE).
