import { describe, it, expect } from 'vitest';
import { rollupSubAgents } from './rollup_subagents.js';
import type { Session } from '../schema/types.js';

const baseSession = (id: string, totals: Partial<Session> = {}): Session => ({
  id, agent: 'claude_code', agent_version: '2.1.94', project_path: '/p',
  started_at: 't0', ended_at: 't1', duration_sec: 0,
  total_fresh_input_tokens: 0, total_output_tokens: 0,
  total_cache_read_tokens: 0, total_cache_write_tokens: 0,
  total_cost_usd: 0, primary_model: 'claude-opus-4-7', turn_count: 0,
  pricing_table_version: 'v', computed_at: 'c',
  agent_reported_cost_usd: null, metadata: {},
  ...totals,
});

describe('rollupSubAgents', () => {
  it('sums sub-agent totals into parent', () => {
    const parent = baseSession('claude_code:p', { total_fresh_input_tokens: 100, total_output_tokens: 200, total_cost_usd: 1, turn_count: 2 });
    const sub1 = baseSession('claude_code:p/sub1', { total_fresh_input_tokens: 50, total_output_tokens: 75, total_cost_usd: 0.5, turn_count: 1 });
    const sub2 = baseSession('claude_code:p/sub2', { total_fresh_input_tokens: 10, total_output_tokens: 20, total_cost_usd: 0.1, turn_count: 1 });
    const merged = rollupSubAgents(parent, [sub1, sub2]);
    expect(merged.total_fresh_input_tokens).toBe(160);
    expect(merged.total_output_tokens).toBe(295);
    expect(merged.total_cost_usd).toBeCloseTo(1.6, 4);
    expect(merged.turn_count).toBe(4);
    expect(merged.metadata.sub_agent_session_ids).toEqual(['claude_code:p/sub1', 'claude_code:p/sub2']);
  });
});
