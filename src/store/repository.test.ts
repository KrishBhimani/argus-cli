import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from './db.js';
import { Repository } from './repository.js';
import type { Session, Turn } from '../schema/types.js';

const SESSION: Session = {
  id: 'claude_code:s1',
  agent: 'claude_code',
  agent_version: '2.1.94',
  project_path: '/proj',
  started_at: '2026-05-01T10:00:00Z',
  ended_at: '2026-05-01T11:00:00Z',
  duration_sec: 3600,
  total_fresh_input_tokens: 100,
  total_output_tokens: 200,
  total_cache_read_tokens: 50,
  total_cache_write_tokens: 10,
  total_cost_usd: 1.5,
  primary_model: 'claude-opus-4-7',
  turn_count: 2,
  pricing_table_version: '2026-05-02',
  computed_at: '2026-05-02T00:00:00Z',
  agent_reported_cost_usd: null,
  metadata: { foo: 'bar' },
};

const TURN: Turn = {
  id: 'claude_code:s1:0',
  session_id: 'claude_code:s1',
  sequence: 0,
  timestamp: '2026-05-01T10:00:00Z',
  model: 'claude-opus-4-7',
  model_raw: 'claude-opus-4-7',
  fresh_input_tokens: 50,
  output_tokens: 100,
  cache_read_tokens: 25,
  cache_write_tokens: 5,
  cache_write_5m_tokens: 5,
  cache_write_1h_tokens: 0,
  tool_calls_count: 1,
  cost_usd: 0.75,
  metadata: {},
};

describe('Repository', () => {
  let repo: Repository;
  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), 'argus-'));
    repo = new Repository(openDb(join(dir, 'argus.db')));
  });

  it('upserts and reads a session', () => {
    repo.upsertSession(SESSION);
    const got = repo.getSession(SESSION.id);
    expect(got).toEqual(SESSION);
  });

  it('upsert is idempotent', () => {
    repo.upsertSession(SESSION);
    repo.upsertSession({ ...SESSION, total_cost_usd: 2.0 });
    expect(repo.getSession(SESSION.id)?.total_cost_usd).toBe(2.0);
  });

  it('upserts and reads turns', () => {
    repo.upsertSession(SESSION);
    repo.upsertTurn(TURN);
    const turns = repo.getTurnsForSession(SESSION.id);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toEqual(TURN);
  });

  it('lists sessions sorted by started_at desc', () => {
    repo.upsertSession({ ...SESSION, id: 'a', started_at: '2026-01-01T00:00:00Z' });
    repo.upsertSession({ ...SESSION, id: 'b', started_at: '2026-05-01T00:00:00Z' });
    const list = repo.listSessions({ limit: 10 });
    expect(list.map(s => s.id)).toEqual(['b', 'a']);
  });

  it('tracks file byte-offsets', () => {
    repo.setFileOffset('/p/f.jsonl', 1234);
    expect(repo.getFileOffset('/p/f.jsonl')).toBe(1234);
    expect(repo.getFileOffset('/p/missing.jsonl')).toBe(0);
  });

  it('records parse errors', () => {
    repo.recordParseError({ file: 'f', byte_offset: 0, reason: 'bad json', raw_line_truncated: '{' });
    const errs = repo.recentParseErrors(10);
    expect(errs).toHaveLength(1);
  });
});
