import { Hono } from 'hono';
import type { Repository } from '../store/repository.js';
import type { IngestStatus } from '../collector/first_run.js';
import type { Adapter } from '../adapters/adapter.js';
import type { PricingTable } from '../pricing/types.js';
import { runSegmentBackfill, getSearchBackfillStatus } from '../collector/search_backfill.js';

export interface ApiDeps {
  pricingTableVersion: string;
  ingestStatus: () => IngestStatus;
  adapters: Adapter[];
  pricingTable: PricingTable;
}

const WINDOWS: Record<string, number | null> = { 'today': 1, '7d': 7, '30d': 30, 'all': null };

// Sub-agent sessions are stored as their own rows under ids like
// "<agent>:<parent>/<subagent-file>". They've already been rolled up into
// their parent session's totals, so we must exclude them from any aggregate
// view to avoid double-counting.
const isTopLevel = (id: string) => !id.includes('/');

// Sessions with zero turns are typically Codex stubs (binary launched, no
// prompt sent → session_meta written but no token_count events) or legacy /
// truncated files. They have no usable cost or token data — exclude from
// listings and aggregates so the dashboard shows only sessions that actually
// did something.
import type { Session } from '../schema/types.js';
const isMeaningful = (s: Session) => s.turn_count > 0
  || s.total_cost_usd > 0
  || s.total_fresh_input_tokens + s.total_output_tokens + s.total_cache_read_tokens + s.total_cache_write_tokens > 0;

function weekOf(iso: string): string {
  const d = new Date(iso);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const diff = (d.getTime() - start.getTime()) / 86_400_000;
  return String(Math.floor((diff + start.getUTCDay()) / 7) + 1).padStart(2, '0');
}

// Convert a window slug → ISO cutoff string. '' is "all time" — every real
// timestamp sorts above it.
function cutoffIsoForWindow(window: string): string {
  const days = WINDOWS[window];
  return days ? new Date(Date.now() - days * 86_400_000).toISOString() : '';
}

// Rollup MCP server name from a tool name matching `mcp__<server>__<tool>`.
// Anything that doesn't match returns null. Naming convention enforced by
// Claude Code's MCP integration; brittle if a server name itself contains
// `__`, but that's been called out as a known limitation in the spec.
function mcpServerName(toolName: string): string | null {
  if (!toolName.startsWith('mcp__')) return null;
  const rest = toolName.slice('mcp__'.length);
  const sep = rest.indexOf('__');
  if (sep < 0) return null;
  return rest.slice(0, sep);
}

// Origin allowlist for state-changing requests. Argus has no auth (it's a
// local-first single-user tool), so the only line of defense against CSRF
// is rejecting cross-origin POSTs. Without this, any webpage the user
// visits while argus is running could fire-and-forget a POST to
// /api/search-index/clear and silently wipe their data.
//
// Permits same-origin (no Origin header on a same-origin GET-derived
// fetch is fine for read-only verbs, but POSTs from real browsers
// always carry Origin in modern environments) and any localhost / 127
// origin (so a dev opening a second port still works). Rejects null,
// arbitrary http(s)://example.com, and missing-on-non-GET.
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return origin.startsWith('http://localhost:')
      || origin.startsWith('http://127.0.0.1:')
      || origin.startsWith('http://[::1]:');
}

export function buildApi(repo: Repository, deps: ApiDeps) {
  const app = new Hono();

  // CSRF guard for POST/PUT/DELETE/PATCH. GET stays unrestricted because
  // it must work from the static dashboard (browsers omit Origin on
  // same-origin GETs in some setups). The dashboard never issues
  // cross-origin POSTs, so legitimate traffic is unaffected.
  app.use('/api/*', async (c, next) => {
    const method = c.req.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }
    if (!isAllowedOrigin(c.req.header('origin'))) {
      return c.json({ error: 'cross-origin requests not allowed' }, 403);
    }
    return next();
  });

  app.get('/api/sessions', (c) => {
    const limit = Number(c.req.query('limit') ?? 100);
    const offset = Number(c.req.query('offset') ?? 0);
    const agent = c.req.query('agent') ?? undefined;
    const includeSub = c.req.query('includeSub') === 'true';
    const sessions = repo.listSessions({ limit, offset, agent }).filter(s => (includeSub || isTopLevel(s.id)) && isMeaningful(s));
    return c.json({ sessions });
  });

  app.get('/api/sessions/:id', (c) => {
    const id = c.req.param('id');
    const session = repo.getSession(id);
    if (!session) return c.json({ error: 'not found' }, 404);
    const turns = repo.getTurnsForSession(id);
    return c.json({ session, turns });
  });

  app.get('/api/overview', (c) => {
    const window = c.req.query('window') ?? '7d';
    const cutoff = cutoffIsoForWindow(window);

    // Turn-level aggregation. See repository.aggregateTurnsByDay for why
    // session-level filtering by started_at was wrong (sessions that started
    // before the window but had turns inside it were dropped entirely; the
    // heatmap dumped each session's lifetime cost on its start day).
    const rows = repo.aggregateTurnsByDay(cutoff);

    // session_id → agent lookup, scoped to sessions that actually appear in
    // the turn aggregation. Cheap: one listSessions read at startup of the
    // request, indexed by id.
    const sessionAgent = new Map<string, string>();
    for (const s of repo.listSessions({ limit: 100_000 })) {
      sessionAgent.set(s.id, s.agent);
    }

    let totalCost = 0;
    let totalTokens = 0;
    const byDay: Record<string, number> = {};
    const split: Record<string, { cost: number; sessions: number; tokens: number }> = {};
    const sessionsPerAgent: Record<string, Set<string>> = {};
    const activeSessions = new Set<string>();

    for (const r of rows) {
      const tokens = r.fresh_input + r.output + r.cache_read + r.cache_write;
      totalCost += r.cost;
      totalTokens += tokens;
      byDay[r.day] = (byDay[r.day] ?? 0) + r.cost;
      activeSessions.add(r.session_id);
      const agent = sessionAgent.get(r.session_id) ?? 'unknown';
      split[agent] ??= { cost: 0, sessions: 0, tokens: 0 };
      split[agent].cost += r.cost;
      split[agent].tokens += tokens;
      // sessions is a unique-session-id count per agent — accumulate via a
      // set then write the count at the end so a session contributing
      // multiple (day, model) rows isn't double-counted.
      (sessionsPerAgent[agent] ??= new Set<string>()).add(r.session_id);
    }
    for (const [agent, set] of Object.entries(sessionsPerAgent)) {
      split[agent].sessions = set.size;
    }

    return c.json({
      window, total_cost_usd: totalCost, total_tokens: totalTokens,
      session_count: activeSessions.size, agent_split: split, cost_by_day: byDay,
    });
  });

  app.get('/api/trends', (c) => {
    const granularity = (c.req.query('granularity') ?? 'day') as 'day' | 'week' | 'month';
    const groupBy = (c.req.query('groupBy') ?? 'agent') as 'agent' | 'model';

    // Same root cause + same fix as /api/overview: aggregate from turns by
    // their own timestamp, not from session lifetime totals keyed on
    // session.started_at. A session that started in month N-1 but had turns
    // in month N should appear in N's bucket — the session-based version
    // silently dropped it.
    const rows = repo.aggregateTurnsByDay(''); // '' = all time
    const sessionAgent = new Map<string, string>();
    for (const s of repo.listSessions({ limit: 100_000 })) {
      sessionAgent.set(s.id, s.agent);
    }

    const rebucket = (day: string) => granularity === 'day' ? day
      : granularity === 'week' ? `${day.slice(0, 4)}-W${weekOf(day)}`
      : day.slice(0, 7);

    const points: Record<string, Record<string, { cost: number; tokens: number; sessions: number; _sessionSet?: Set<string> }>> = {};
    for (const r of rows) {
      const b = rebucket(r.day);
      const k = groupBy === 'agent' ? (sessionAgent.get(r.session_id) ?? 'unknown') : r.model;
      points[b] ??= {};
      points[b][k] ??= { cost: 0, tokens: 0, sessions: 0, _sessionSet: new Set<string>() };
      points[b][k].cost += r.cost;
      // Preserve the prior "fresh + output" token semantic for trends so
      // existing dashboards don't shift unexpectedly. The aggregation
      // source is now correct (turn timestamps), the WHAT-is-counted is
      // unchanged.
      points[b][k].tokens += r.fresh_input + r.output;
      points[b][k]._sessionSet!.add(r.session_id);
    }
    // Finalize unique-session counts per (bucket, group) and strip the
    // temporary _sessionSet helper before serializing.
    for (const groups of Object.values(points)) {
      for (const k of Object.keys(groups)) {
        groups[k].sessions = groups[k]._sessionSet!.size;
        delete groups[k]._sessionSet;
      }
    }
    return c.json({ granularity, groupBy, points: Object.entries(points).sort().map(([bucket, groups]) => ({ bucket, groups })) });
  });

  // ─── Slice 1: Tools ────────────────────────────────────────────────────

  app.get('/api/tools/overview', (c) => {
    const window = c.req.query('window') ?? '7d';
    const cutoff = cutoffIsoForWindow(window);

    const totals = repo.toolCallsTotal(cutoff);
    const leaderboardRaw = repo.toolLeaderboard(cutoff, 20);
    const leaderboard = leaderboardRaw.map(r => ({
      name: r.name,
      calls: r.calls,
      errors: r.errors ?? 0,
      error_rate: r.calls > 0 ? Math.round(((r.errors ?? 0) / r.calls) * 100) / 100 : 0,
    }));

    const mcpRows = repo.mcpToolCalls(cutoff);
    const mcpAgg = new Map<string, { calls: number; errors: number; tools: Set<string> }>();
    for (const row of mcpRows) {
      const server = mcpServerName(row.tool_name);
      if (!server) continue;
      const cur = mcpAgg.get(server) ?? { calls: 0, errors: 0, tools: new Set<string>() };
      cur.calls += row.calls;
      cur.errors += row.errors ?? 0;
      cur.tools.add(row.tool_name);
      mcpAgg.set(server, cur);
    }
    const mcp_servers = [...mcpAgg.entries()]
      .map(([server, v]) => ({ server, calls: v.calls, errors: v.errors, tools_used: v.tools.size }))
      .sort((a, b) => b.calls - a.calls);

    const subagents = repo.subagentCalls(cutoff).map(r => ({
      type: r.type,
      calls: r.calls,
      errors: r.errors ?? 0,
    }));

    return c.json({
      window,
      total_calls: totals.total,
      total_errors: totals.errors,
      tool_leaderboard: leaderboard,
      mcp_servers,
      subagents,
    });
  });

  // ─── Slice 1: Prompts ──────────────────────────────────────────────────

  app.get('/api/prompts', (c) => {
    const q = (c.req.query('q') ?? '').trim();
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const project = c.req.query('project') || undefined;
    const includeSlash = c.req.query('include_slash') === '1';

    // Same opt-out hard-gate as /api/search. Lower-level endpoint, but
    // the same user-facing rule applies: flag off → nothing surfaces.
    if (!repo.isSearchIndexingEnabled()) {
      return c.json({ total: 0, prompts: [] });
    }

    let result;
    try {
      result = repo.searchPrompts({ q, limit, project, includeSlash });
    } catch (e) {
      // FTS5 raises a syntax error on unbalanced quotes / bad operators.
      // Retry with the raw input wrapped in double quotes (phrase search).
      const escaped = q.replace(/"/g, '""');
      try {
        result = repo.searchPrompts({ q: `"${escaped}"`, limit, project, includeSlash });
      } catch {
        // Pathological input — give up, return empty results rather than 500.
        result = { total: 0, rows: [] };
      }
    }

    const prompts = result.rows.map((r: any) => ({
      id: r.id,
      timestamp_ms: r.timestamp_ms,
      project_path: r.project_path,
      display: r.display,
      snippet: r.snippet ?? r.display,
      pasted_chars: r.pasted_chars,
      session_id: repo.linkPromptToSession(r.project_path, r.timestamp_ms),
    }));

    return c.json({ total: result.total, prompts });
  });

  app.get('/api/prompts/stats', (c) => {
    if (!repo.isSearchIndexingEnabled()) return c.json({ total: 0, projects: 0, oldest_ms: null });
    return c.json(repo.promptStats());
  });

  app.get('/api/prompts/projects', (c) => {
    if (!repo.isSearchIndexingEnabled()) return c.json({ projects: [] });
    return c.json({ projects: repo.promptProjects() });
  });

  // ─── Slice 2: unified search (prompts + transcripts) ───────────────────

  // Searches both prompts (your typed input) and transcript_segments
  // (assistant text, user content, tool_result content). Results are
  // labeled by source/role so the UI can distinguish "you asked" from
  // "Claude said" from "tool output". When q is empty we return prompts
  // recents only (transcripts are huge — chronological browsing is
  // session-scoped, not global).
  //
  // When transcript indexing is OFF, the transcripts portion of the
  // response is always empty regardless of `roles=` — searching data
  // that the user has explicitly opted out of would surprise them.
  // (Existing rows aren't deleted automatically when toggling off, but
  // they're hidden from search until re-enabled. `argus search clear`
  // wipes them.)
  app.get('/api/search', (c) => {
    const q = (c.req.query('q') ?? '').trim();
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const project = c.req.query('project') || undefined;
    const includeSlash = c.req.query('include_slash') === '1';
    // role filter is comma-separated. omitted = all roles + prompts.
    const rolesParam = c.req.query('roles');
    const wantedRoles = rolesParam ? rolesParam.split(',').filter(Boolean) : null;
    const includePrompts = !wantedRoles || wantedRoles.includes('prompt');
    const transcriptRoles = wantedRoles
      ? wantedRoles.filter(r => r !== 'prompt')
      : ['user', 'assistant', 'thinking', 'tool_result'];
    const searchEnabled = repo.isSearchIndexingEnabled();

    type Result = {
      kind: 'prompt' | 'transcript';
      role: string;          // 'prompt' | 'user' | 'assistant' | 'thinking' | 'tool_result'
      timestamp_ms: number;
      project_path: string | null;
      text: string;
      snippet: string;
      pasted_chars: number;
      session_id: string | null;
    };
    const results: Result[] = [];
    let promptTotal = 0;
    let transcriptTotal = 0;

    // Hard-gate the entire endpoint on the indexing flag. The data sits
    // on disk (history.jsonl is always ingested; transcript_segments
    // accumulates only when on) but search reveals none of it when the
    // user has explicitly opted out — "off" should mean off everywhere,
    // not "off for some sources".
    if (!searchEnabled) {
      return c.json({
        total: 0, prompt_total: 0, transcript_total: 0,
        search_indexing_enabled: false,
        results: [],
      });
    }

    // Prompts side
    if (includePrompts) {
      let pr;
      try {
        pr = repo.searchPrompts({ q, limit, project, includeSlash });
      } catch {
        const escaped = q.replace(/"/g, '""');
        try { pr = repo.searchPrompts({ q: `"${escaped}"`, limit, project, includeSlash }); }
        catch { pr = { total: 0, rows: [] as any[] }; }
      }
      promptTotal = pr.total;
      for (const r of pr.rows) {
        results.push({
          kind: 'prompt', role: 'prompt',
          timestamp_ms: r.timestamp_ms,
          project_path: r.project_path,
          text: r.display,
          snippet: r.snippet ?? r.display,
          pasted_chars: r.pasted_chars,
          session_id: repo.linkPromptToSession(r.project_path, r.timestamp_ms),
        });
      }
    }

    // Transcripts side. Only meaningful when q is non-empty (chronological
    // browse over millions of segments isn't a useful product) AND the
    // indexing flag is on.
    if (q && transcriptRoles.length && searchEnabled) {
      let tr;
      try {
        tr = repo.searchTranscripts({ q, limit, project, roles: transcriptRoles });
      } catch {
        const escaped = q.replace(/"/g, '""');
        try { tr = repo.searchTranscripts({ q: `"${escaped}"`, limit, project, roles: transcriptRoles }); }
        catch { tr = { total: 0, rows: [] as any[] }; }
      }
      transcriptTotal = tr.total;
      for (const r of tr.rows) {
        const ts = Date.parse(r.timestamp);
        results.push({
          kind: 'transcript', role: r.role,
          timestamp_ms: Number.isFinite(ts) ? ts : 0,
          project_path: r.project_path,
          text: r.text,
          snippet: r.snippet,
          pasted_chars: 0,
          session_id: r.session_id,
        });
      }
    }

    // Merge: keep most-recent first when there's no query (browse mode);
    // otherwise interleave by score-bucket — but since FTS5 returns
    // bm25-ranked rows already we just keep prompt hits first and trust
    // the per-source ordering. Simple concat is fine for a v1; better
    // ranking can come later.
    if (!q) results.sort((a, b) => b.timestamp_ms - a.timestamp_ms);

    return c.json({
      total: promptTotal + transcriptTotal,
      prompt_total: promptTotal,
      transcript_total: transcriptTotal,
      search_indexing_enabled: searchEnabled,
      results: results.slice(0, limit),
    });
  });

  // Per-session transcript search. The session detail page calls this with
  // its own session id; q is required (without it the page just shows the
  // turn list as before). Same opt-in rule as /api/search.
  app.get('/api/sessions/:id/transcript', (c) => {
    const id = c.req.param('id');
    const q = (c.req.query('q') ?? '').trim();
    const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
    if (!q) return c.json({ total: 0, segments: [], search_indexing_enabled: repo.isSearchIndexingEnabled() });
    if (!repo.isSearchIndexingEnabled()) return c.json({ total: 0, segments: [], search_indexing_enabled: false });
    let r;
    try {
      r = repo.searchTranscripts({ q, limit, sessionId: id });
    } catch {
      const escaped = q.replace(/"/g, '""');
      try { r = repo.searchTranscripts({ q: `"${escaped}"`, limit, sessionId: id }); }
      catch { r = { total: 0, rows: [] as any[] }; }
    }
    const segments = r.rows.map((row: any) => ({
      uid: row.uid,
      timestamp: row.timestamp,
      role: row.role,
      text: row.text,
      snippet: row.snippet,
    }));
    return c.json({ total: r.total, segments });
  });

  // ─── Slice 3: opt-in transcript indexing ───────────────────────────────

  // Status — enabled flag, on-disk segment count, distinct sessions
  // covered, and the in-progress backfill (if any). Drives the toggle
  // and stats on the Settings page.
  app.get('/api/search-index/status', (c) => {
    const enabled = repo.isSearchIndexingEnabled();
    const segs = repo.segmentStats();
    return c.json({
      enabled,
      segment_count: segs.total,
      indexed_sessions: segs.sessions,
      backfill: getSearchBackfillStatus(),
    });
  });

  // Toggle on. Sets the flag and immediately kicks off a background
  // backfill of any sessions that don't have segments yet. Returns
  // before the backfill finishes so the UI stays responsive — the
  // status endpoint can be polled to follow progress.
  app.post('/api/search-index/enable', async (c) => {
    repo.setSearchIndexingEnabled(true);
    // Fire-and-forget; runSegmentBackfill is internally async and
    // updates a process-local progress object that /status reads.
    runSegmentBackfill(deps.adapters, repo, deps.pricingTable).catch(() => { /* logged via parse_errors */ });
    return c.json({ enabled: true, backfill: getSearchBackfillStatus() });
  });

  // Toggle off. Existing segments are NOT deleted — they stay on disk
  // and remain queryable if the flag is flipped back on. The pipeline
  // and backfill paths both check the flag, so no new segments will be
  // written until re-enabled. Use /clear to also wipe existing data.
  app.post('/api/search-index/disable', (c) => {
    repo.setSearchIndexingEnabled(false);
    return c.json({ enabled: false });
  });

  // Wipe + disable. Drops every transcript_segments row (and through
  // the FTS5 sync trigger, every FTS row) and turns the flag off.
  // Then runs VACUUM so the freed pages actually shrink the file on
  // disk — without it, SQLite would keep the freed pages around for
  // future reuse and the user would see no change in file size.
  // Idempotent; safe to call repeatedly.
  app.post('/api/search-index/clear', (c) => {
    const beforeBytes = repo.dbSizeBytes();
    repo.clearAllSegments();
    repo.setSearchIndexingEnabled(false);
    repo.vacuum();
    const afterBytes = repo.dbSizeBytes();
    return c.json({
      enabled: false,
      cleared: true,
      freed_bytes: Math.max(0, beforeBytes - afterBytes),
      db_size_bytes: afterBytes,
    });
  });

  app.get('/api/ingest/status', (c) => {
    // ingestStatus().processed/total only reflect the FIRST-PASS startup
    // ingest — once the backfill finishes those counters freeze. New
    // sessions picked up by the chokidar watcher land in the DB but
    // don't move those numbers. sessionCount reads the real, current
    // count from the DB using the same predicates the Sessions page
    // uses, so the footer reflects truth (and updates as new sessions
    // are watched in).
    const sessionCount = repo.listSessions({ limit: 100_000 })
      .filter(s => isTopLevel(s.id) && isMeaningful(s)).length;
    return c.json({ ...deps.ingestStatus(), sessionCount });
  });
  app.get('/api/pricing', (c) => c.json({ version: deps.pricingTableVersion }));

  app.get('/api/export.json', (c) => {
    const sessions = repo.listSessions({ limit: 1_000_000 }).filter(s => isTopLevel(s.id) && isMeaningful(s));
    return c.json({ sessions });
  });

  app.get('/api/export.csv', (c) => {
    const rows = repo.listSessions({ limit: 1_000_000 }).filter(s => isTopLevel(s.id) && isMeaningful(s));
    const header = 'id,agent,started_at,ended_at,project_path,primary_model,total_cost_usd,total_fresh_input_tokens,total_output_tokens,turn_count\n';
    const body = rows.map(s => [s.id, s.agent, s.started_at, s.ended_at ?? '', s.project_path, s.primary_model, s.total_cost_usd, s.total_fresh_input_tokens, s.total_output_tokens, s.turn_count].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    return c.body(header + body, 200, { 'content-type': 'text/csv' });
  });

  app.get('/api/parse-errors', (c) => c.json({ errors: repo.recentParseErrors(100) }));

  return app;
}
