# Argus Slice 1 — Tools page + Prompts page

**Status:** Approved design, awaiting implementation plan
**Date:** 2026-05-02
**Predecessor:** Argus MVP (shipped) — see `docs/superpowers/plans/2026-05-02-argus-mvp.md`
**Backlog:** `docs/feature-backlog.md`

---

## 1. Goal

Push Argus past ccusage parity. Today the dashboard answers the same questions
ccusage does (tokens, cost, top sessions, top models) with a nicer UI. To
justify itself as a separate tool, Argus needs to surface data that lives only
on the user's local disk and that ccusage cannot see.

This slice adds two new dashboard pages:

1. **Tools** — analytics over the `tool_use` blocks already present in every
   parsed JSONL. Shows what Claude actually *does* in your sessions.
2. **Prompts** — full-text search over every prompt the user has ever typed,
   sourced from `~/.claude/history.jsonl`.

Both surface differentiating data. Both reuse the existing ingest, schema, and
charting infrastructure — no new external dependencies.

## 2. Non-goals

- Codex CLI support (explicitly removed earlier; not coming back).
- Searching Claude's *responses* or full transcript bodies (parked as "4b" in
  the backlog; revisit after Prompts has been used in anger).
- Per-tool-call duration metrics — not reliably available in JSONL.
- File-history hotspots, plugin/skill inventory, plan economics, budgets,
  resume button — all in the backlog, none in this slice.
- Pasted-content search (just record size, don't index body).

## 3. Architecture overview

The slice fits cleanly into the existing pipeline:

```
~/.claude/projects/<encoded-cwd>/<sid>.jsonl   ──┐
~/.claude/history.jsonl                        ──┤── chokidar watcher (extended)
                                                 │
                                                 ▼
                                        Ingest pipeline
                                                 │
                ┌────────────────────────────────┼──────────────────────────┐
                ▼                                ▼                          ▼
        sessions, turns                    tool_calls               prompts + prompts_fts
        (existing tables)                  (new table)             (new table + FTS5 vt)
                                                 │                          │
                                                 └────────┬─────────────────┘
                                                          ▼
                                                 hono API layer
                                          (/api/tools/overview, /api/prompts)
                                                          │
                                                          ▼
                                                Astro dashboard
                                          (tools.astro, prompts.astro)
```

Two new ingestion code paths, two new tables (one with an FTS5 sibling), one
new watcher path, one schema migration, two new API routes, two new dashboard
pages, one nav update.

## 4. Schema (MIGRATION_002)

Added to `src/store/migrations/inline.ts` as `MIGRATION_002`, applied on first
start after upgrade. Existing data is not touched; new columns on `sessions`
are backfilled from existing TEXT timestamps as part of the migration.

### 4.1 `tool_calls` table

```sql
CREATE TABLE tool_calls (
  id              TEXT PRIMARY KEY,            -- composite: "{session_id}:{tool_use_id}"
                                               -- tool_use_id is assigned by Claude per
                                               -- block and is stable across tail re-ingests,
                                               -- so repeated reads upsert in place.
  session_id      TEXT NOT NULL,
  turn_index      INTEGER NOT NULL,            -- 0-based ordering hint within the batch
                                               -- (informational only, not part of the key)
  tool_name       TEXT NOT NULL,               -- e.g. "Bash", "Edit", "mcp__context7__query-docs"
  is_error        INTEGER NOT NULL DEFAULT 0,  -- from the matching tool_result.is_error
  input_size      INTEGER NOT NULL DEFAULT 0,  -- JSON.stringify(block.input).length
  subagent_type   TEXT,                        -- non-null only when tool_name = 'Task'
  timestamp       TEXT NOT NULL,               -- assistant turn's timestamp (ISO)
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX idx_tool_calls_session ON tool_calls(session_id);
CREATE INDEX idx_tool_calls_name    ON tool_calls(tool_name);
CREATE INDEX idx_tool_calls_ts      ON tool_calls(timestamp);
```

**Notes:**
- MCP server name is *derived at query time* by regex `^mcp__([^_]+(?:_[^_]+)*)__` —
  not stored. Keeps the convention out of the schema.
- `subagent_type` is the only "input field" we extract. We do not store full
  input JSON; future structured fields (file paths, command strings) can be
  added as nullable columns when there's a concrete page that needs them.
- `is_error` is determined by matching the `tool_use_id` against the
  corresponding `tool_result` block in the next user message. If no matching
  result is found (last block in an aborted session), default to 0.

### 4.2 `prompts` table + `prompts_fts` virtual table

```sql
CREATE TABLE prompts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp_ms    INTEGER NOT NULL,
  project_path    TEXT NOT NULL,                -- normalized: forward slashes, lowercase on Windows
  display         TEXT NOT NULL,                -- prompt text, capped at 8 KB; longer is truncated
  pasted_chars    INTEGER NOT NULL DEFAULT 0,
  is_slash        INTEGER NOT NULL DEFAULT 0    -- 1 if display.trimStart() starts with '/'
);
CREATE INDEX idx_prompts_ts      ON prompts(timestamp_ms);
CREATE INDEX idx_prompts_project ON prompts(project_path);

CREATE VIRTUAL TABLE prompts_fts USING fts5(
  display,
  content='prompts',
  content_rowid='id',
  tokenize='unicode61'
);

-- Sync triggers (standard FTS5 external-content table pattern):
CREATE TRIGGER prompts_ai AFTER INSERT ON prompts BEGIN
  INSERT INTO prompts_fts(rowid, display) VALUES (new.id, new.display);
END;
CREATE TRIGGER prompts_ad AFTER DELETE ON prompts BEGIN
  INSERT INTO prompts_fts(prompts_fts, rowid, display) VALUES('delete', old.id, old.display);
END;
CREATE TRIGGER prompts_au AFTER UPDATE ON prompts BEGIN
  INSERT INTO prompts_fts(prompts_fts, rowid, display) VALUES('delete', old.id, old.display);
  INSERT INTO prompts_fts(rowid, display) VALUES (new.id, new.display);
END;
```

**Why `unicode61`:** handles unicode tokens, case-insensitive by default,
strips diacritics — matches user expectation for natural-language search.

### 4.3 `sessions` denormalized timestamp columns

To make prompt→session linkage fast (a SQL range join, not a per-row TEXT
parse):

```sql
ALTER TABLE sessions ADD COLUMN started_at_ms INTEGER;
ALTER TABLE sessions ADD COLUMN ended_at_ms   INTEGER;
CREATE INDEX idx_sessions_time ON sessions(project_path, started_at_ms, ended_at_ms);

-- Backfill from existing ISO TEXT columns:
UPDATE sessions
SET started_at_ms = CAST(strftime('%s', started_at) AS INTEGER) * 1000,
    ended_at_ms   = CAST(strftime('%s', ended_at)   AS INTEGER) * 1000
WHERE started_at_ms IS NULL;
```

The repository CRUD layer (`src/store/repo.ts`) is updated so future inserts
write both the TEXT and ms columns.

## 5. Ingest pipeline changes

### 5.1 Tool-call extraction

`src/adapters/claude_code/extract.ts` (existing turn extractor) is extended to
also emit `ToolCall[]` per turn. Signature changes from `extractTurn(line) →
Turn` to `extractTurn(line) → { turn: Turn, tool_calls: ToolCall[] }`.

Logic:

1. For each `assistant` message, walk `content[]`.
2. For each `tool_use` block, emit a `ToolCall` with `tool_name`, `input_size`
   (`JSON.stringify(input).length`), and `subagent_type` (only when
   `tool_name === 'Task'`, pulled from `input.subagent_type`).
3. For the matching `tool_result` block in the next user message (matched by
   `tool_use_id`), set `is_error = 1` if `tool_result.is_error` is true.
4. Composite id is `${session_id}:${turn_index}:${block_index}`.

`src/collector/aggregate.ts` (the `buildSession` aggregator) gathers
`tool_calls` from all turns into the session result. `src/collector/pipeline.ts`
upserts `tool_calls` in the same transaction that upserts `turns`. On
re-ingest of a tail, all of the session's tool_calls are recomputed and
replaced for that session — same merge semantics as turns.

### 5.2 Prompts ingester

New file `src/adapters/claude_code/history_jsonl.ts`. Mirrors the byte-offset
tail of the session JSONL ingester:

```ts
async function ingestHistoryFile(db: Db, path: string, lastOffset: number)
  → { newOffset: number, prompts: PromptRow[] }
```

- Open the file, seek to `lastOffset`, read to EOF.
- Split on `\n`; if the last chunk has no trailing newline, treat it as a
  partial line and back the offset up to the last newline before EOF.
- Parse each complete line with a zod schema:
  ```ts
  z.object({
    display: z.string(),
    pastedContents: z.record(z.unknown()).optional().default({}),
    timestamp: z.number(),
    project: z.string(),
  })
  ```
- Skip lines where `display.trim() === ''`.
- Cap `display` at 8 KB; anything longer is truncated with a `…` suffix.
- Compute `pasted_chars` as `JSON.stringify(pastedContents).length` (cheap
  upper bound; fine for the badge).
- Compute `is_slash` as `display.trimStart().startsWith('/') ? 1 : 0`.
- Normalize `project_path`:
  - On all platforms: replace `\\` with `/`.
  - On Windows: also lowercase.
  - This is the same normalization applied when ingesting `cwd` for sessions,
    so the two paths can be joined directly. Existing session ingest is
    audited for parity as part of the implementation.
- Bulk insert into `prompts`; FTS5 sync happens via the trigger.
- Persist new offset to the existing `ingest_state` table under key
  `history_jsonl:<absolute-path>`.

### 5.3 Watcher

`src/ingest/watcher.ts` (chokidar) is extended to watch
`~/.claude/history.jsonl` in addition to the projects directory. On a `change`
event for that path, the prompts ingester runs.

### 5.4 Two-phase first-run ingest

The existing ingest has a foreground phase (recent sessions) and a background
phase (full backfill). Both new code paths fold in:

- Foreground: `tool_calls` extracted alongside turns for every session being
  ingested anyway. `history.jsonl` is read end-to-end on first run (it's small
  enough; ~1500 lines for a heavy user).
- Background: existing JSONL files that were ingested *before* this slice
  shipped have no `tool_calls` rows. The background phase walks any session
  whose `id` is not present in `tool_calls` and re-extracts. The footer pill
  reads "Backfilling tool data..." while this runs.

The pricing-table version stamp is unaffected.

## 6. API surface

Two new routes, both following the existing hono pattern in `src/server/api.ts`.

### 6.1 `GET /api/tools/overview`

Query params:
- `window`: one of `today | 7d | 30d | all` (default `7d`)

Response:
```ts
{
  total_calls: number,
  total_errors: number,
  tool_leaderboard: Array<{
    name: string,
    calls: number,
    errors: number,
    error_rate: number   // 0..1, two-decimal rounded
  }>,
  mcp_servers: Array<{
    server: string,
    calls: number,
    tools_used: number,  // distinct tool names within this server
    errors: number
  }>,
  subagents: Array<{
    type: string,
    calls: number,
    errors: number
  }>
}
```

Implementation:
- Filter `tool_calls` by timestamp window (computed in JS, passed as a SQL
  parameter; reuses the helper that the overview endpoint already uses).
- `tool_leaderboard`: `GROUP BY tool_name ORDER BY calls DESC LIMIT 20`.
- `mcp_servers`: filter rows where `tool_name LIKE 'mcp\_\_%' ESCAPE '\'`,
  derive server with the regex, group by server.
- `subagents`: filter rows where `subagent_type IS NOT NULL`, group by
  `subagent_type`.
- Empty arrays when there's no data; never null.

### 6.2 `GET /api/prompts`

Query params:
- `q`: search string (optional; empty/missing → chronological recents)
- `limit`: integer, default 50, max 200
- `project`: optional project_path filter (already-normalized form)
- `include_slash`: `'1'` to include slash-command prompts; default `'0'`

Response:
```ts
{
  total: number,         // total matches before limit applied
  prompts: Array<{
    id: number,
    timestamp_ms: number,
    project_path: string,
    display: string,
    snippet: string,     // FTS5 snippet() output with <mark>...</mark>; equals display when no q
    pasted_chars: number,
    session_id: string | null
  }>
}
```

Implementation:
- When `q` is set, query `prompts_fts MATCH ? ORDER BY bm25(prompts_fts)`.
- When `q` is empty, query `prompts ORDER BY timestamp_ms DESC`.
- Apply `include_slash = 0` filter via `is_slash = 0` predicate.
- Apply `project` filter via equality.
- Wrap the FTS5 query in a try/catch; on `SyntaxError` (unbalanced quote, bad
  operator), fall back to a phrase-quoted version of the raw input. Never 500.
- Resolve `session_id` per row via the linkage query:
  ```sql
  SELECT id FROM sessions
  WHERE project_path = :project
    AND started_at_ms <= :ts
    AND (ended_at_ms >= :ts OR ended_at_ms IS NULL)
  ORDER BY ABS(started_at_ms - :ts)
  LIMIT 1;
  ```
  If no match, `session_id` is `null`. Done as a per-row subquery; for the
  default `limit=50` this is 50 fast indexed lookups, not a perf concern.

## 7. UI

### 7.1 `dashboard/src/pages/tools.astro` (new)

Layout (top to bottom):

1. **Window selector** (`<select>` with today / 7d / 30d / all). Same control
   as overview; reuses the same change handler pattern.
2. **KPI strip** (4 tiles in a `.grid-3` style row that shrinks to 2 on
   narrow viewports):
   - Total tool calls
   - Error rate (overall, percentage)
   - Top tool by calls
   - Top MCP server by calls (or "—" if none)
3. **Tool leaderboard chart** — horizontal bar (top 12). Reuses the
   `modelMix(...)` ECharts pattern from `src/scripts/charts.ts`. New helper
   `toolBars(...)` if the styling diverges.
4. **MCP servers panel** + **Subagents panel** in a `.grid-2`. Each is a
   horizontal bar chart. Each renders only if its source array is non-empty;
   otherwise the panel is omitted from the DOM (no hollow widget).
5. **Per-tool detail table** — sortable by calls / errors / error rate.
   Reuses the table style from the Sessions page.

Empty state for the whole page: when `total_calls === 0`, render a single
`.empty` block ("No tool activity in this window") and skip all charts.

### 7.2 `dashboard/src/pages/prompts.astro` (new)

Layout:

1. **Header bar**: search `<input>` (debounced 150ms via a small inline
   helper), project `<select>` (populated from `SELECT DISTINCT project_path
   FROM prompts` via a tiny `/api/prompts/projects` helper endpoint), and a
   "Show slash commands" `<input type=checkbox>`.
2. **Stats strip** (only when `q` is empty and no project filter applied):
   total prompts, distinct projects, oldest timestamp.
3. **Results list**: cards stacked vertically. Each card:
   - Top row: time-ago + project basename + optional `[+ N KB pasted]` tag
   - Snippet with `<mark>` highlighting (FTS5 output is already escaped by
     ECharts? — no, this is plain HTML. We'll sanitize on the server: only
     `<mark>` and `</mark>` are emitted by FTS5's `snippet()` with our chosen
     delimiters; we strip everything else from `display` before substituting,
     so injection isn't possible.)
   - Bottom row: "→ Open session" link if `session_id`, else "(no linked
     session)" muted text.

Empty state: "No prompts indexed yet. Use Claude Code and they'll appear
here." Shown when `total === 0` and `q` is empty.

### 7.3 Navigation

`dashboard/src/layouts/Default.astro` — nav order becomes:

```
Overview · Sessions · Tools · Prompts · Trends · Models · Settings
```

`active` class logic in the existing template handles the new entries.

## 8. Edge cases

| Case                                                   | Behavior                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `~/.claude/history.jsonl` missing                      | Prompts page renders the "no prompts" empty state. No errors.                      |
| `history.jsonl` truncated mid-line during read         | Tail backs off to last newline; partial line is picked up next tick.               |
| `history.jsonl` rotated (offset > current size)        | Reset offset to 0 and re-ingest. Defensive; unlikely in practice.                  |
| Malformed `tool_use` block (zod fails)                 | Skipped silently, debug-logged. Same policy as malformed turns today.              |
| Tool `tool_use_id` has no matching `tool_result`       | `is_error = 0`. Last-block-in-aborted-session case.                                |
| Sessions ingested before this slice (no tool_calls)    | Background phase backfills automatically on next start; footer pill shows status.  |
| FTS5 query syntax error from user input                | Caught, retried with phrase-quoted form. Never 500.                                |
| Project path mismatch (Windows backslash vs forward)   | Normalization applied at write time on both prompts and sessions.                  |
| Multiple sessions overlap in same project at same time | Linkage picks closest `started_at` to the prompt timestamp. Deterministic.         |
| No `tool_use` blocks in window                         | `total_calls === 0` → empty state for the page.                                    |
| `display` over 8 KB                                    | Truncated to 8 KB with `…` suffix on ingest.                                       |
| `pastedContents` is megabytes                          | Body never read into memory beyond `JSON.stringify(...).length`. Char count only.  |

## 9. Tests

### 9.1 Unit

- `extract.ts`: tool extraction emits correct `ToolCall[]` for a fixture with
  Bash + Edit + Task + mcp__foo__bar + erroring tool_result.
- `extract.ts`: subagent_type is null for non-Task tools, set for Task tools.
- `history_jsonl.ts`: parser handles real-format lines (Windows paths, slash
  commands, pasted content, bare prompts).
- `history_jsonl.ts`: project_path normalization round-trips Windows paths.
- `history_jsonl.ts`: byte-offset tail handles partial last line.
- API: tools/overview returns correct aggregates for a fixture set.
- API: prompts search returns ranked results with `<mark>` snippets.
- API: prompts search falls back to phrase-quoted on FTS5 syntax error.
- API: session linkage finds correct session in time-range straddle case.
- API: session linkage returns null when no session matches.

### 9.2 Integration

- Full ingest of a fixture session JSONL populates `tool_calls` correctly,
  including Task subagent_type and MCP names.
- Re-ingest of the same JSONL after a tail-append produces consistent
  `tool_calls` (no duplicates, no orphans).
- Full ingest of a fixture `history.jsonl` populates `prompts` and FTS5 in
  sync; queries return expected rows.
- MIGRATION_002 backfills `started_at_ms`/`ended_at_ms` on existing sessions.
- Background backfill of `tool_calls` for sessions ingested before the slice
  works without breaking ongoing foreground ingest.

## 10. Telemetry / observability

No analytics or telemetry are added. Existing debug-log helper is reused for
malformed-line and ingest-error paths.

## 11. Open questions / known limitations

- **`tool_use_id` matching:** Claude Code's JSONL format puts `tool_use` and
  `tool_result` in separate messages. We assume the result is in the next
  user message in the same session. Sub-agent tool calls live in their own
  JSONL files; their results are local to that file. To verify against real
  fixtures during implementation. If the assumption breaks for a corner case,
  fall back to `is_error = 0` (the safe default).
- **MCP server-name extraction:** assumes the convention
  `mcp__<server>__<tool>`. If a server name itself contains double underscores
  the regex captures only the prefix. Acceptable for now; if a real MCP
  server breaks this, refine.
- **history.jsonl across machines:** the file is local to one Claude Code
  install. Multi-machine merge is out of scope.
- **Slash-command toggle is per-session-of-the-browser, not persisted.**
  Acceptable for v1; persist to localStorage if a user complains.

## 12. Out-of-scope follow-ups (already in backlog)

- Files page from `~/.claude/file-history/`
- Transcript-body FTS5 (4b)
- Per-session in-page transcript search (4a)
- Skills/plugins/agents inventory
- Plan economics & budgets
- Session health & quality signals
- Resume button
- TodoWrite trail
