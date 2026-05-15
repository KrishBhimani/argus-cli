# Argus HTTP API

This is the canonical contract. The bundled dashboard is **one consumer**
of this API; build a different UI in React, Svelte, htmx, the CLI, a Slack
bot, anything — as long as it talks HTTP, it has full access to every metric
Argus computes.

Argus serves these endpoints at `http://127.0.0.1:4242` by default (override
with `argus start --host <h> --port <n>`).

## Conventions

- **All endpoints are GET unless noted.** State-changing endpoints (POST)
  enforce a same-origin check; they reject cross-origin requests with HTTP
  403 to prevent CSRF.
- **Responses echo their filter.** Every aggregate endpoint that accepts the
  `agent` / `backend_agent` filter (see below) includes an
  `applied_filter: { agent: string | null, backend_agent: string | null }`
  field. `null` on an axis means "not filtered". A UI never has to consult
  separate state to know what it's rendering.
- **Numbers are raw, dates are ISO.** Formatting is a UI concern.
- **Shapes are additive.** Fields may be added; fields are not renamed or
  removed without an entry in the changelog at the bottom of this file.
- **No public CORS.** Same-origin (loopback) only. Serving a custom UI from
  `localhost:<n>` works.

## The two-axis filter

Every endpoint listed under "Filtered shared endpoints" accepts:

| Param | Type | Default | Meaning |
|---|---|---|---|
| `agent` | string | omit = all | `claude_code`, `openclaw`, etc. |
| `backend_agent` | string | omit = all | OpenClaw's named agents (`admin`, `dev`, `main`, …). Meaningless without `agent`. |

Examples:
- `?agent=openclaw` → all OpenClaw activity, any named agent
- `?agent=openclaw&backend_agent=admin` → only `admin`
- `?agent=claude_code` → only Claude Code (Claude Code has no named-agent dimension)
- (no params) → everything

---

## `GET /api/agents` — the manifest

Drives the dashboard nav dropdown and the global filter picker. Any UI
should call this first to discover what backends exist and what they can do.

```json
{
  "agents": [
    {
      "name": "claude_code",
      "display_name": "Claude Code",
      "capabilities": {
        "reportsNativeCost": false,
        "hasToolCalls": true,
        "hasTranscriptSegments": true,
        "hasPrompts": true
      },
      "backend_agents": null,
      "page_path": "/agents/claude-code"
    },
    {
      "name": "openclaw",
      "display_name": "OpenClaw",
      "capabilities": {
        "reportsNativeCost": true,
        "hasToolCalls": true,
        "hasTranscriptSegments": false,
        "hasPrompts": false
      },
      "backend_agents": ["admin", "agent-dev", "default", "design", "dev", "main"],
      "page_path": "/agents/openclaw"
    }
  ]
}
```

- `capabilities.reportsNativeCost` — `true` means the adapter writes cost
  directly into turns (no pricing-table compute). Pair with a "reported"
  marker in your UI; the cost is whatever the upstream agent billed.
- `backend_agents` — `null` for backends with no named-agent dimension;
  an array of names for those that do.
- `page_path` — suggested URL for a dedicated per-agent view, if a UI wants
  one. Optional.

---

## Filtered shared endpoints

### `GET /api/overview?window=<w>[&agent=<a>&backend_agent=<b>]`

Window-bucketed totals. Aggregates from the `turns` table (not session
lifetime totals — see ARCHITECTURE.md for why).

`window`: `today` | `7d` | `30d` | `all`. Default `7d`.

```jsonc
{
  "window": "7d",
  "total_cost_usd": 4.21,
  "total_tokens": 8421052,
  "session_count": 14,
  "agent_split": { "claude_code": { "cost": 3.50, "sessions": 8, "tokens": 5_000_000 }, "openclaw": { ... } },
  "cost_by_day": { "2026-05-09": 1.21, "2026-05-10": 3.00 },
  "cost_by_model": { "claude-opus-4-7": 3.50, "kimi-code": 0.71 },
  "top_sessions": [
    { "id": "claude_code:abc", "started_at": "...", "project_path": "/p", "primary_model": "...", "window_cost_usd": 2.10, "window_tokens": 1_204_512, "days_active": 1 }
  ],
  "applied_filter": { "agent": null, "backend_agent": null }
}
```

### `GET /api/sessions?[limit=<n>&offset=<n>&agent=<a>&backend_agent=<b>&includeSub=<bool>]`

```json
{ "sessions": [ /* Session[] */ ], "applied_filter": { "agent": null, "backend_agent": null } }
```

Each `Session` includes `id`, `agent`, `backend_agent`, `project_path`,
`started_at`, `ended_at`, `total_*_tokens`, `total_cost_usd`,
`primary_model`, `pricing_table_version` (`'openclaw-reported'` for
native-cost rows), `metadata` (free-form per agent — OpenClaw stores a
`title` derived from the first user message), and more.

`includeSub=true` shows sub-agent rollup sessions (ids containing `/`).
Default false.

### `GET /api/sessions/:id`

```json
{ "session": { /* Session */ }, "turns": [ /* Turn[] */ ] }
```

Per-turn objects include `provider` (`'kimi'` / `'anthropic'` / etc. — null
for Claude Code) and `cost_usd` (verbatim for OpenClaw, computed for
Claude Code).

### `GET /api/tools/overview?window=<w>[&agent=<a>&backend_agent=<b>]`

```json
{
  "window": "7d",
  "total_calls": 1042,
  "total_errors": 12,
  "tool_leaderboard": [ { "name": "Bash", "calls": 342, "errors": 4, "error_rate": 0.01 } ],
  "mcp_servers": [ { "server": "github", "calls": 12, "errors": 0, "tools_used": 3 } ],
  "subagents": [ { "type": "Explore", "calls": 8, "errors": 0 } ],
  "applied_filter": { "agent": null, "backend_agent": null }
}
```

### `GET /api/trends?granularity=<day|week|month>&groupBy=<agent|model|backend_agent>[&agent=<a>&backend_agent=<b>]`

```json
{
  "granularity": "day",
  "groupBy": "agent",
  "points": [
    { "bucket": "2026-05-09", "groups": { "claude_code": { "cost": 1.21, "tokens": 421052, "sessions": 3 } } }
  ],
  "applied_filter": { "agent": null, "backend_agent": null }
}
```

`groupBy=backend_agent` is only meaningful scoped to one backend that has
named agents.

### `GET /api/export.json` and `GET /api/export.csv`

Same `agent` / `backend_agent` filter. JSON returns `{ sessions, applied_filter }`.
CSV columns: `id,agent,backend_agent,started_at,ended_at,project_path,primary_model,total_cost_usd,total_fresh_input_tokens,total_output_tokens,turn_count`.

---

## Per-agent endpoints

Each adapter contributes routes under `/api/agents/<name>/*`. The list is
discoverable via the manifest's `page_path` and any UI's awareness of the
backend's data shape.

### `GET /api/agents/openclaw/named-agents?window=<w>`

```json
{
  "window": "7d",
  "named_agents": [
    { "name": "admin", "sessions": 12, "tokens": 4_200_000, "cost_usd": 2.10, "last_active": "2026-05-15T18:00:00Z" }
  ]
}
```

Sorted by `cost_usd` desc.

### `GET /api/agents/openclaw/providers?window=<w>`

```json
{
  "window": "7d",
  "providers": [
    { "provider": "kimi", "models": 1, "sessions": 14, "tokens": 6_100_000, "cost_usd": 2.40 }
  ]
}
```

### `GET /api/agents/claude-code/sub-agents?window=<w>`

```json
{
  "window": "7d",
  "sub_agents": [
    { "type": "Explore", "invocations": 42, "errors": 0, "error_rate": 0 }
  ]
}
```

---

## Claude-Code-only endpoints

These were shipped in Slice 1/2 and stay Claude-Code-only. The capability
flag `hasPrompts` / `hasTranscriptSegments` advertises whether each agent
contributes.

| Endpoint | Purpose |
|---|---|
| `GET /api/prompts` | Search prompts from `~/.claude/history.jsonl`. |
| `GET /api/prompts/stats` | Total / projects / oldest. |
| `GET /api/prompts/projects` | Distinct projects in the index. |
| `GET /api/search` | Unified search across prompts + transcripts (opt-in). |
| `GET /api/sessions/:id/transcript` | Per-session transcript search (opt-in). |
| `GET /api/search-index/status` | Toggle state + on-disk segment count. |
| `POST /api/search-index/enable` | Enable + start backfill. Same-origin only. |
| `POST /api/search-index/disable` | Disable. Same-origin only. |
| `POST /api/search-index/clear` | Wipe + disable + VACUUM. Same-origin only. |

These return empty results when called with `agent=openclaw`.

---

## Operational endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/pricing` | `{ version }` of the bundled LiteLLM pricing table. |
| `GET /api/ingest/status` | First-pass ingest progress + live session count. |
| `GET /api/parse-errors` | Recent JSONL parse errors. |

---

## A minimal custom UI

```html
<!doctype html>
<html><body>
<select id="agent"></select>
<pre id="out"></pre>
<script type="module">
  const agents = (await (await fetch('/api/agents')).json()).agents;
  const sel = document.getElementById('agent');
  sel.innerHTML = '<option value="">All</option>' +
    agents.map(a => `<option value="${a.name}">${a.display_name}</option>`).join('');
  async function refresh() {
    const q = sel.value ? '?window=7d&agent=' + sel.value : '?window=7d';
    const r = await (await fetch('/api/overview' + q)).json();
    document.getElementById('out').textContent = JSON.stringify(r, null, 2);
  }
  sel.addEventListener('change', refresh);
  refresh();
</script>
</body></html>
```

Drop it in `~/.argus/` (or anywhere on `localhost`) and you have a working
custom dashboard.

---

## Changelog

Shape changes are additive. Renames / removals require a `MIGRATION_N`
comment + a line here.

- **Slice 3 (2026-05):** `/api/agents` manifest endpoint added.
  `agent` / `backend_agent` filter added to `/api/overview`,
  `/api/sessions`, `/api/tools/overview`, `/api/trends`, `/api/export.*`.
  `applied_filter` field added to every filtered response.
  `Session.backend_agent` added. `Turn.provider` added. Per-agent endpoints
  `/api/agents/openclaw/{named-agents,providers}` and
  `/api/agents/claude-code/sub-agents` added.
- **Slice 2 (2026-05-04):** `/api/search` and `/api/sessions/:id/transcript` added.
- **Slice 1 (2026-05-02):** `/api/tools/overview` and `/api/prompts*` added.
