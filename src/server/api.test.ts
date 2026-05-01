import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../store/db.js';
import { Repository } from '../store/repository.js';
import { buildApi } from './api.js';
import type { Session } from '../schema/types.js';
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
    repo.upsertSession(SESSION('a', new Date(Date.now() - 86_400_000).toISOString()));
    repo.upsertSession(SESSION('b', new Date(Date.now() - 86_400_000 * 30).toISOString(), 'codex'));
    const r = await app.request('/api/overview?window=7d');
    const body = await r.json();
    expect(body.total_cost_usd).toBeCloseTo(1.5, 4);
    expect(body.session_count).toBe(1);
    expect(body.agent_split.claude_code.cost).toBeCloseTo(1.5, 4);
  });

  it('GET /api/trends groups by day and agent', async () => {
    repo.upsertSession(SESSION('a', new Date(Date.now() - 86_400_000).toISOString()));
    const r = await app.request('/api/trends?granularity=day&groupBy=agent');
    const body = await r.json();
    expect(Array.isArray(body.points)).toBe(true);
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
