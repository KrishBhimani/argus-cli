import { Hono } from 'hono';
import type { Repository } from '../store/repository.js';
import type { IngestStatus } from '../collector/first_run.js';

export interface ApiDeps { pricingTableVersion: string; ingestStatus: () => IngestStatus; }

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

export function buildApi(repo: Repository, deps: ApiDeps) {
  const app = new Hono();

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
    const days = WINDOWS[window];
    const cutoff = days ? new Date(Date.now() - days * 86_400_000).toISOString() : '0';
    const all = repo.listSessions({ limit: 100_000 }).filter(s => isTopLevel(s.id) && s.started_at >= cutoff);

    const totals = all.reduce((a, s) => ({
      cost: a.cost + s.total_cost_usd,
      tokens: a.tokens + s.total_fresh_input_tokens + s.total_output_tokens + s.total_cache_read_tokens + s.total_cache_write_tokens,
    }), { cost: 0, tokens: 0 });

    const split: Record<string, { cost: number; sessions: number; tokens: number }> = {};
    for (const s of all) {
      split[s.agent] ??= { cost: 0, sessions: 0, tokens: 0 };
      split[s.agent].cost += s.total_cost_usd;
      split[s.agent].sessions += 1;
      split[s.agent].tokens += s.total_fresh_input_tokens + s.total_output_tokens + s.total_cache_read_tokens + s.total_cache_write_tokens;
    }

    const byDay: Record<string, number> = {};
    for (const s of all) {
      const day = s.started_at.slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + s.total_cost_usd;
    }

    return c.json({
      window, total_cost_usd: totals.cost, total_tokens: totals.tokens,
      session_count: all.length, agent_split: split, cost_by_day: byDay,
    });
  });

  app.get('/api/trends', (c) => {
    const granularity = (c.req.query('granularity') ?? 'day') as 'day' | 'week' | 'month';
    const groupBy = (c.req.query('groupBy') ?? 'agent') as 'agent' | 'model';
    const all = repo.listSessions({ limit: 100_000 }).filter(s => isTopLevel(s.id) && isMeaningful(s));
    const bucket = (iso: string) => granularity === 'day' ? iso.slice(0, 10)
      : granularity === 'week' ? `${iso.slice(0, 4)}-W${weekOf(iso)}`
      : iso.slice(0, 7);
    const points: Record<string, Record<string, { cost: number; tokens: number; sessions: number }>> = {};
    for (const s of all) {
      const b = bucket(s.started_at);
      const k = groupBy === 'agent' ? s.agent : s.primary_model;
      points[b] ??= {};
      points[b][k] ??= { cost: 0, tokens: 0, sessions: 0 };
      points[b][k].cost += s.total_cost_usd;
      points[b][k].tokens += s.total_fresh_input_tokens + s.total_output_tokens;
      points[b][k].sessions += 1;
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
    return c.json(repo.promptStats());
  });

  app.get('/api/prompts/projects', (c) => {
    return c.json({ projects: repo.promptProjects() });
  });

  app.get('/api/ingest/status', (c) => c.json(deps.ingestStatus()));
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
