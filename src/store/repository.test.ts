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

  it('upserts tool_calls and aggregates the leaderboard', () => {
    repo.upsertSession(SESSION);
    repo.upsertToolCalls([
      { id: 'claude_code:s1:t1', session_id: SESSION.id, turn_index: 0, tool_name: 'Bash', is_error: 0, input_size: 10, subagent_type: null, timestamp: '2026-05-01T10:00:00Z' },
      { id: 'claude_code:s1:t2', session_id: SESSION.id, turn_index: 0, tool_name: 'Bash', is_error: 1, input_size: 20, subagent_type: null, timestamp: '2026-05-01T10:01:00Z' },
      { id: 'claude_code:s1:t3', session_id: SESSION.id, turn_index: 1, tool_name: 'Edit', is_error: 0, input_size: 30, subagent_type: null, timestamp: '2026-05-01T10:02:00Z' },
    ]);
    const board = repo.toolLeaderboard('', 10);
    expect(board.find(r => r.name === 'Bash')?.calls).toBe(2);
    expect(board.find(r => r.name === 'Bash')?.errors).toBe(1);
    expect(board.find(r => r.name === 'Edit')?.calls).toBe(1);

    // Idempotent re-upsert with same ids does not duplicate
    repo.upsertToolCalls([
      { id: 'claude_code:s1:t1', session_id: SESSION.id, turn_index: 0, tool_name: 'Bash', is_error: 0, input_size: 10, subagent_type: null, timestamp: '2026-05-01T10:00:00Z' },
    ]);
    expect(repo.countToolCallsForSession(SESSION.id)).toBe(3);
  });

  it('finds session matching a prompt by project + timestamp range', () => {
    repo.upsertSession(SESSION); // started 10:00, ended 11:00, project=/proj
    const inside = repo.linkPromptToSession('/proj', Date.parse('2026-05-01T10:30:00Z'));
    expect(inside).toBe(SESSION.id);

    const before = repo.linkPromptToSession('/proj', Date.parse('2026-05-01T09:00:00Z'));
    expect(before).toBeNull();

    const wrongProject = repo.linkPromptToSession('/elsewhere', Date.parse('2026-05-01T10:30:00Z'));
    expect(wrongProject).toBeNull();
  });

  it('subagent rollup picks up Task tool calls only', () => {
    repo.upsertSession(SESSION);
    repo.upsertToolCalls([
      { id: 'claude_code:s1:a', session_id: SESSION.id, turn_index: 0, tool_name: 'Task', is_error: 0, input_size: 50, subagent_type: 'Explore', timestamp: '2026-05-01T10:00:00Z' },
      { id: 'claude_code:s1:b', session_id: SESSION.id, turn_index: 1, tool_name: 'Task', is_error: 0, input_size: 50, subagent_type: 'Plan',    timestamp: '2026-05-01T10:01:00Z' },
      { id: 'claude_code:s1:c', session_id: SESSION.id, turn_index: 2, tool_name: 'Bash', is_error: 0, input_size: 5,  subagent_type: null,     timestamp: '2026-05-01T10:02:00Z' },
    ]);
    const sub = repo.subagentCalls('');
    expect(sub.map(s => s.type).sort()).toEqual(['Explore', 'Plan']);
    expect(sub.find(s => s.type === 'Explore')?.calls).toBe(1);
  });

  it('inserts prompts and FTS search returns matches with snippet markers', () => {
    repo.insertPrompts([
      { timestamp_ms: 1000, project_path: '/p', display: 'how do I configure vitest', pasted_chars: 0, is_slash: 0 },
      { timestamp_ms: 2000, project_path: '/p', display: 'unrelated', pasted_chars: 0, is_slash: 0 },
      { timestamp_ms: 3000, project_path: '/p', display: 'vitest hangs', pasted_chars: 0, is_slash: 0 },
    ]);
    const r = repo.searchPrompts({ q: 'vitest', limit: 10 });
    expect(r.total).toBe(2);
    expect(r.rows.every(row => row.snippet.includes('<mark>'))).toBe(true);
  });

  it('upserts transcript segments and FTS search returns matches', () => {
    repo.upsertSession(SESSION);
    repo.upsertTranscriptSegments([
      { uid: 'claude_code:s1:u1:0', session_id: SESSION.id, timestamp: '2026-05-01T10:00:00Z', role: 'user', text: 'how do I check ccusage output' },
      { uid: 'claude_code:s1:a1:0', session_id: SESSION.id, timestamp: '2026-05-01T10:00:01Z', role: 'assistant', text: 'ccusage prints summary statistics' },
      { uid: 'claude_code:s1:a2:0', session_id: SESSION.id, timestamp: '2026-05-01T10:00:02Z', role: 'assistant', text: 'unrelated text' },
    ]);
    const r = repo.searchTranscripts({ q: 'ccusage', limit: 10 });
    expect(r.total).toBe(2);
    expect(r.rows.every(row => row.snippet.includes('<mark>'))).toBe(true);
  });

  it('searchTranscripts respects role filter', () => {
    repo.upsertSession(SESSION);
    repo.upsertTranscriptSegments([
      { uid: 'claude_code:s1:u1:0', session_id: SESSION.id, timestamp: '2026-05-01T10:00:00Z', role: 'user', text: 'find ccusage' },
      { uid: 'claude_code:s1:a1:0', session_id: SESSION.id, timestamp: '2026-05-01T10:00:01Z', role: 'assistant', text: 'about ccusage' },
    ]);
    const userOnly = repo.searchTranscripts({ q: 'ccusage', limit: 10, roles: ['user'] });
    expect(userOnly.total).toBe(1);
    expect(userOnly.rows[0].role).toBe('user');
  });

  it('searchTranscripts is upsert-idempotent (same uid, no duplicates)', () => {
    repo.upsertSession(SESSION);
    const seg = { uid: 'claude_code:s1:u1:0', session_id: SESSION.id, timestamp: '2026-05-01T10:00:00Z', role: 'user' as const, text: 'ccusage v1' };
    repo.upsertTranscriptSegments([seg]);
    repo.upsertTranscriptSegments([{ ...seg, text: 'ccusage v2 updated' }]);
    expect(repo.countSegmentsForSession(SESSION.id)).toBe(1);
    const r = repo.searchTranscripts({ q: 'updated', limit: 10 });
    expect(r.total).toBe(1);
  });
});
