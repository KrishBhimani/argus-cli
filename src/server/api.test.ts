import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../store/db.js';
import { Repository } from '../store/repository.js';
import { buildApi } from './api.js';
import type { Session, Turn } from '../schema/types.js';
import type { IngestStatus } from '../collector/first_run.js';

const SESSION = (id: string, ts: string, agent: 'claude_code' | 'codex' = 'claude_code'): Session => ({
  id, agent, agent_version: '2.1.94', project_path: '/p',
  started_at: ts, ended_at: ts, duration_sec: 0,
  total_fresh_input_tokens: 100, total_output_tokens: 200,
  total_cache_read_tokens: 0, total_cache_write_tokens: 0,
  total_cost_usd: 1.5, primary_model: 'claude-opus-4-7', turn_count: 1,
  pricing_table_version: '2026-05-02', computed_at: ts,
  agent_reported_cost_usd: null, metadata: {},
});

// Minimal Turn factory. /api/overview and /api/trends both aggregate from
// turns now (see the windowed-undercount fix), so any test exercising those
// endpoints needs at least one turn per session it wants reflected in the
// totals. cost and the four token fields are the only ones the aggregation
// actually reads — the rest are filler.
const TURN = (id: string, session_id: string, ts: string, opts: {
  cost?: number; fresh?: number; output?: number; cache_read?: number; cache_write?: number;
  model?: string;
} = {}): Turn => ({
  id, session_id, sequence: 0, timestamp: ts,
  model: opts.model ?? 'claude-opus-4-7', model_raw: opts.model ?? 'claude-opus-4-7',
  fresh_input_tokens: opts.fresh ?? 100,
  output_tokens: opts.output ?? 200,
  cache_read_tokens: opts.cache_read ?? 0,
  cache_write_tokens: opts.cache_write ?? 0,
  cache_write_5m_tokens: null, cache_write_1h_tokens: null,
  tool_calls_count: 0, cost_usd: opts.cost ?? 1.5,
  metadata: {},
});

describe('API', () => {
  let app: ReturnType<typeof buildApi>;
  let repo: Repository;
  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), 'argus-'));
    const db = openDb(join(dir, 'argus.db'));
    repo = new Repository(db);
    const status: () => IngestStatus = () => ({ foregroundComplete: true, pending: 0, processed: 1, total: 1 });
    app = buildApi(repo, { pricingTableVersion: '2026-05-02', ingestStatus: status });
  });

  it('GET /api/sessions returns sorted list', async () => {
    repo.upsertSession(SESSION('a', '2026-01-01T00:00:00Z'));
    repo.upsertSession(SESSION('b', '2026-05-01T00:00:00Z'));
    const r = await app.request('/api/sessions');
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.sessions.map((s: Session) => s.id)).toEqual(['b', 'a']);
  });

  it('GET /api/sessions/:id returns session + turns', async () => {
    repo.upsertSession(SESSION('a', '2026-05-01T00:00:00Z'));
    const r = await app.request('/api/sessions/a');
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.session.id).toBe('a');
    expect(body.turns).toEqual([]);
  });

  it('GET /api/overview returns totals for window', async () => {
    const recent = new Date(Date.now() - 86_400_000).toISOString();
    const old = new Date(Date.now() - 86_400_000 * 30).toISOString();
    repo.upsertSession(SESSION('a', recent));
    repo.upsertSession(SESSION('b', old, 'codex'));
    // Recent turn → in window. Old turn → out of window, ignored by aggregation.
    repo.upsertTurn(TURN('a-t1', 'a', recent));
    repo.upsertTurn(TURN('b-t1', 'b', old));
    const r = await app.request('/api/overview?window=7d');
    const body = await r.json();
    expect(body.total_cost_usd).toBeCloseTo(1.5, 4);
    expect(body.session_count).toBe(1);
    expect(body.agent_split.claude_code.cost).toBeCloseTo(1.5, 4);
  });

  // Regression: a session that STARTED before the 7-day window but had a
  // turn INSIDE the window used to be excluded entirely from /api/overview
  // (because the filter was session.started_at >= cutoff). With turn-level
  // aggregation it must now appear in totals, cost_by_day, top_sessions,
  // and cost_by_model.
  it('GET /api/overview includes turns from sessions that started before the window', async () => {
    const oldStart = new Date(Date.now() - 86_400_000 * 21).toISOString(); // 3 weeks ago
    const recentTurn = new Date(Date.now() - 86_400_000 * 2).toISOString(); // 2 days ago
    repo.upsertSession(SESSION('long-runner', oldStart));
    repo.upsertTurn(TURN('lr-t1', 'long-runner', recentTurn, { cost: 4.25 }));

    const r = await app.request('/api/overview?window=7d');
    const body = await r.json();
    expect(body.total_cost_usd).toBeCloseTo(4.25, 4);
    expect(body.session_count).toBe(1);
    expect(body.cost_by_day[recentTurn.slice(0, 10)]).toBeCloseTo(4.25, 4);
    // Top Sessions table needs the resumed session to show up too —
    // previously the dashboard filtered by started_at and dropped it.
    expect(body.top_sessions).toHaveLength(1);
    expect(body.top_sessions[0].id).toBe('long-runner');
    expect(body.top_sessions[0].window_cost_usd).toBeCloseTo(4.25, 4);
    expect(body.top_sessions[0].started_at).toBe(oldStart); // metadata preserved
    // Top Models chart needs the model too — same bug pattern, same fix.
    expect(body.cost_by_model['claude-opus-4-7']).toBeCloseTo(4.25, 4);
  });

  // Per-row Option B: each top_sessions row reports the session's
  // contribution IN THE WINDOW, not its lifetime total. Sum of the rows'
  // window_cost_usd must equal the hero's total_cost_usd.
  it('GET /api/overview top_sessions rows show window-only totals, summing to the hero', async () => {
    const now = Date.now();
    repo.upsertSession(SESSION('a', new Date(now - 86_400_000 * 2).toISOString()));
    repo.upsertSession(SESSION('b', new Date(now - 86_400_000 * 30).toISOString())); // started outside window
    repo.upsertTurn(TURN('a-t1', 'a', new Date(now - 86_400_000 * 2).toISOString(), { cost: 1.0 }));
    repo.upsertTurn(TURN('a-t2', 'a', new Date(now - 86_400_000 * 1).toISOString(), { cost: 2.0 }));
    repo.upsertTurn(TURN('b-t1', 'b', new Date(now - 86_400_000 * 3).toISOString(), { cost: 3.0 }));  // resumed today
    // A turn from session 'b' that's outside the window — must NOT count.
    repo.upsertTurn(TURN('b-old', 'b', new Date(now - 86_400_000 * 30).toISOString(), { cost: 99.0 }));

    const r = await app.request('/api/overview?window=7d');
    const body = await r.json();

    // hero = sum of per-session window cost
    const sumRows = body.top_sessions.reduce((acc: number, s: any) => acc + s.window_cost_usd, 0);
    expect(sumRows).toBeCloseTo(body.total_cost_usd, 4);
    expect(body.total_cost_usd).toBeCloseTo(6.0, 4); // 1+2+3, NOT 1+2+3+99
    // 'a' has 2 days active in window, 'b' has 1
    const aRow = body.top_sessions.find((s: any) => s.id === 'a');
    const bRow = body.top_sessions.find((s: any) => s.id === 'b');
    expect(aRow.window_cost_usd).toBeCloseTo(3.0, 4);
    expect(aRow.days_active).toBe(2);
    expect(bRow.window_cost_usd).toBeCloseTo(3.0, 4); // lifetime would be 102 — but we want WINDOW
    expect(bRow.days_active).toBe(1);
  });

  // Regression: cost_by_day used to key on session.started_at, so a multi-
  // day session dumped all its lifetime cost on day 1. With turn aggregation
  // it must distribute across the actual turn dates.
  it('GET /api/overview distributes a multi-day session across actual turn dates', async () => {
    const start = new Date(Date.now() - 86_400_000 * 3).toISOString();
    const day1 = new Date(Date.now() - 86_400_000 * 3).toISOString();
    const day2 = new Date(Date.now() - 86_400_000 * 1).toISOString();
    repo.upsertSession(SESSION('multi-day', start));
    repo.upsertTurn(TURN('md-t1', 'multi-day', day1, { cost: 2.0 }));
    repo.upsertTurn(TURN('md-t2', 'multi-day', day2, { cost: 3.0 }));

    const r = await app.request('/api/overview?window=7d');
    const body = await r.json();
    expect(body.total_cost_usd).toBeCloseTo(5.0, 4);
    expect(body.cost_by_day[day1.slice(0, 10)]).toBeCloseTo(2.0, 4);
    expect(body.cost_by_day[day2.slice(0, 10)]).toBeCloseTo(3.0, 4);
  });

  it('GET /api/trends groups by day and agent', async () => {
    const ts = new Date(Date.now() - 86_400_000).toISOString();
    repo.upsertSession(SESSION('a', ts));
    repo.upsertTurn(TURN('a-t1', 'a', ts));
    const r = await app.request('/api/trends?granularity=day&groupBy=agent');
    const body = await r.json();
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points.length).toBeGreaterThan(0);
  });

  it('GET /api/ingest/status reports', async () => {
    const r = await app.request('/api/ingest/status');
    const body = await r.json();
    expect(body.foregroundComplete).toBe(true);
    expect(body.total).toBe(1);
  });

  it('GET /api/pricing returns version', async () => {
    const r = await app.request('/api/pricing');
    const body = await r.json();
    expect(body.version).toBe('2026-05-02');
  });

  it('GET /api/export.json returns all sessions', async () => {
    repo.upsertSession(SESSION('a', '2026-05-01T00:00:00Z'));
    const r = await app.request('/api/export.json');
    expect((await r.json()).sessions.length).toBe(1);
  });

  it('GET /api/export.csv returns CSV header', async () => {
    const r = await app.request('/api/export.csv');
    expect(r.headers.get('content-type')).toMatch(/text\/csv/);
  });

  it('GET /api/parse-errors returns array', async () => {
    const r = await app.request('/api/parse-errors');
    expect(Array.isArray((await r.json()).errors)).toBe(true);
  });
});
