import { describe, it, expectTypeOf } from 'vitest';
import type { Session, Turn, AgentName, NormalizedCacheFields } from './types.js';

describe('schema types', () => {
  it('Session has all required fields', () => {
    const s: Session = {
      id: 'claude_code:abc',
      agent: 'claude_code',
      agent_version: '2.1.94',
      project_path: 'C:/proj',
      started_at: '2026-05-01T10:00:00Z',
      ended_at: '2026-05-01T11:00:00Z',
      duration_sec: 3600,
      total_fresh_input_tokens: 100,
      total_output_tokens: 200,
      total_cache_read_tokens: 50,
      total_cache_write_tokens: 10,
      total_cost_usd: 0.5,
      primary_model: 'claude-opus-4-7',
      turn_count: 5,
      pricing_table_version: '2026-05-02',
      computed_at: '2026-05-02T00:00:00Z',
      agent_reported_cost_usd: null,
      metadata: {},
      backend_agent: null,
    };
    expectTypeOf(s.agent).toEqualTypeOf<AgentName>();
  });

  it('NormalizedCacheFields enforces Codex zero-write rule', () => {
    const c: NormalizedCacheFields = {
      fresh_input_tokens: 100,
      cache_read_tokens: 20,
      cache_write_tokens: 0,
      cache_write_5m_tokens: null,
      cache_write_1h_tokens: null,
    };
    expectTypeOf(c).toMatchTypeOf<NormalizedCacheFields>();
  });
});
