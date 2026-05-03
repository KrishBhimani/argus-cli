# Argus Feature Backlog

A living menu of features we've discussed for Argus, with their current status.
This is the shared memory between the user and Claude across sessions — when in
doubt about scope or "did we already talk about X", check here first.

**Last updated:** 2026-05-02

---

## Why this exists

Argus today (post-MVP) does what ccusage does, with a nicer UI: token totals,
cost over time, top sessions, top models. To justify its existence as a separate
tool, it needs to answer questions ccusage cannot — by exploiting data sources
that only exist on the user's local machine (the full `~/.claude/` directory,
not just the JSONL transcripts).

This backlog captures the menu of ideas we've considered for that push.

---

## Status legend

- **🟢 Shipping** — actively in scope for the current slice
- **🟡 Parked** — interesting, deferred to a later slice
- **🔴 Dropped** — considered, decided against (reason captured)
- **⚪ Idea** — raw idea, not yet evaluated

---

## Current slice: "Things ccusage cannot do"

### 🟢 Tools page (new)

**What:** A new dashboard page surfacing tool-call analytics extracted from the
existing JSONL `tool_use` blocks we already parse.

**Surfaces:**
- Tool-call leaderboard (which tools you use most: Bash, Edit, Read, WebFetch, …)
- Error rates per tool
- MCP server breakdown (tool names matching `mcp__<server>__<tool>` rolled up
  by server, so you can see "do my MCP servers earn their keep")
- Sub-agent invocation counts (how often you delegate, to which subagent type,
  rough cost per dispatch)
- Tool-token vs output-token ratio per session ("tool-heavy" vs "thinking-heavy")

**Why it differentiates:** ccusage is purely cost/token. This page tells you
*how you actually use Claude Code* — useful for tuning your own workflow and
for deciding which MCP servers / subagents to keep.

**Data source:** existing JSONL files we already ingest. No new file watchers.

---

### 🟢 Prompts page (new)

**What:** A search-first page over every prompt the user has ever typed,
backed by SQLite FTS5.

**Source:** `~/.claude/history.jsonl` — a global file (not per-session) that
Claude Code writes for every command typed at the prompt. Each line has
`{display, pastedContents, timestamp, project}`. ~1500 lines for our test user
— small enough that the index builds in <1 second.

**Surfaces:**
- Search box (`"vitest hangs"` → ranked list of matching prompts)
- Each result: timestamp, project, snippet of the prompt
- Click-through: navigate to the session that contains that prompt
  (linkage by `project` + `timestamp` → session whose `started_at` straddles
  the timestamp and whose `project_path` matches)

**Why it differentiates:** the killer "find that thing I asked Claude about
last month" feature. ccusage has no concept of prompt content.

**Out of scope for this slice:** searching Claude's *responses* or the body of
JSONL transcripts (see "4b transcript search" in Parked).

---

## Parked (next slice candidates)

### 🟡 Files page (`~/.claude/file-history/`)

**What:** Claude Code silently versions every file it touches into
`~/.claude/file-history/<session-id>/<file-hash>@v<N>`. We can build:

- Most-edited files leaderboard (across all sessions)
- Per-project hotspot view ("which files in this repo does Claude beat up on")
- Version count per file
- Diff viewer (show what changed between v3 and v4) — Phase 2

**Why parked:** strong feature, but Tools + Prompts win on "open it daily"
ranking. Once those two ship and we've used them for a week, this is a strong
next pick.

---

### 🟢 4b — Transcript search (FTS5 over all JSONL bodies) — **shipped 2026-05-04**

Indexes assistant text, thinking blocks, user text, and tool_result content
into a `transcript_segments` table with an FTS5 sibling. The Prompts page is
now a unified Search page that searches both prompts and transcripts;
results are labeled by role ("you typed" / "you said" / "claude said" /
"claude thinking" / "tool output").

Real-data confirmation: "ccusage" went from 0 hits (history.jsonl only) to
41 hits across transcript bodies. Search latency stays sub-millisecond.

Slice 2 spec: lived in conversation, not formally written. Implementation
covered by MIGRATION_003 + extract_transcript.ts + repo helpers + new
`/api/search` and `/api/sessions/:id/transcript` endpoints.

---

### 🟢 4a — Per-session search — **shipped 2026-05-04**

A search box on the session detail page hits
`/api/sessions/:id/transcript?q=…` and shows ranked, role-labeled,
chronologically-sorted matches inside that one session. Auto-runs when
arriving from the global Search page with `?q=…` in the URL — so
"find that thing" → click "Open session" → already filtered to where
the term appears.

---

### 🟡 Plan economics & budgets

- "You'd have spent $X on API; Max plan saves $Y" calculator
- Burn rate + projected month-end spend
- Daily/weekly budget with footer-pill warnings
- Cache savings counter ("you saved $X.XX from cache hits this month")

**Why parked:** all useful, but "cost is an estimate anyway" tension and the
user explicitly de-emphasized cost in the current UI. Revisit after Tools
+ Prompts.

---

### 🟡 Session health & quality signals

- Aborted/empty sessions surfaced in their own view (currently hidden by the
  `isMeaningful` filter)
- Long-session warnings ("this session has 142 turns, consider `/clear`")
- Sessions that hit context limit
- Cache hit rate per session — low hit rate = you're rewriting prompts
  unnecessarily

**Why parked:** these fall out cheaply once Tools page exists (most of these
are tool-call / turn-count derived). Roll them in as a "Sessions Health"
sub-tab on the Tools page later.

---

### 🟡 Skills / plugins / agents inventory

**Source:**
- `~/.claude/skills/` — your custom skills (carousel, cost-reducer, etc.)
- `~/.claude/plugins/installed_plugins.json` — installed plugins
- `~/.claude/.../agents/` — custom subagents

**What:** a Settings sub-page listing what custom config you have, last
modified, and (cross-referenced from Tools page data) how often each gets
used.

**Why parked:** low-frequency view ("did I forget I had this skill?"). Useful
*after* Tools page exists to answer "is anyone actually invoking my custom
skill?".

---

### 🟡 Resume button

**What:** Click a session → "Resume" button copies `claude --resume <id>` to
clipboard, or shells out directly.

**Why parked:** Windows shell-out is finicky; clipboard copy is doable today
but not as exciting as the analytics features. Trivial to add when we want.

---

### 🟡 TodoWrite trail

**Source:** `~/.claude/todos/<session-id>-agent-<id>.json`

**What:** Show "what did I plan to do but not finish" — surface non-empty todo
files with incomplete items.

**Why parked:** most files we sampled are empty `[]`. Low signal-to-noise.

---

## Dropped

### 🔴 Codex CLI support

**Why dropped:** user explicitly said "this is a personal tool and i use claude
code the most" — Codex code path was removed before MVP shipped. Not coming
back unless explicitly requested.

---

## Design / spec links

When a slice gets a formal design document, link it here:

- **Slice 1 (Tools + Prompts):** [`docs/superpowers/specs/2026-05-02-argus-tools-prompts-design.md`](superpowers/specs/2026-05-02-argus-tools-prompts-design.md)

---

## Notes for future-Claude reading this file

- The user prefers concrete features over abstract architecture talk. Lead with
  "what does the user click on, and what do they see".
- The user de-emphasized cost in the UI deliberately — tokens-first, cost as
  estimate. Don't reintroduce cost as the headline metric without checking.
- The user asked "i think for now we should remove all codex related things" —
  do not reintroduce Codex without explicit ask.
- ccusage parity is *not* a goal; differentiation is.
- "Does ccusage already do this?" is the test for whether a feature is
  worth shipping. If yes, deprioritize.
