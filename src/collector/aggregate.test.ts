import { describe, it, expect } from 'vitest';
import { aggregateAdapterResult } from './aggregate.js';
import type { PricingTable } from '../pricing/types.js';

const TABLE: PricingTable = { version: '2026-05-02', models: { 'claude-opus-4-7': { input: 5, output: 25, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.50 } } };

describe('aggregateAdapterResult', () => {
  it('rolls up turn totals into session', () => {
    const { session, turns } = aggregateAdapterResult(
      {
        header: { native_session_id: 's1', agent: 'claude_code', agent_version: '2.1.94', project_path: '/p', started_at: 't0', ended_at: 't1', agent_reported_cost_usd: null, metadata: {} },
        turns: [
          { native_turn_id: 'm1', sequence: 0, timestamp: 't0', model: 'claude-opus-4-7', model_raw: 'claude-opus-4-7', fresh_input_tokens: 1_000_000, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cache_write_5m_tokens: null, cache_write_1h_tokens: null, tool_calls_count: 0, metadata: {} },
          { native_turn_id: 'm2', sequence: 1, timestamp: 't1', model: 'claude-opus-4-7', model_raw: 'claude-opus-4-7', fresh_input_tokens: 0, output_tokens: 1_000_000, cache_read_tokens: 0, cache_write_tokens: 0, cache_write_5m_tokens: null, cache_write_1h_tokens: null, tool_calls_count: 1, metadata: {} },
        ],
        parse_errors: [],
      },
      TABLE
    );
    expect(session.id).toBe('claude_code:s1');
    expect(session.total_fresh_input_tokens).toBe(1_000_000);
    expect(session.total_output_tokens).toBe(1_000_000);
    expect(session.total_cost_usd).toBeCloseTo(5 + 25, 4);
    expect(session.primary_model).toBe('claude-opus-4-7');
    expect(session.turn_count).toBe(2);
    expect(turns).toHaveLength(2);
    expect(turns[0].id).toBe('claude_code:s1:m1');
  });

  it('picks primary_model by sum of (input+output) tokens', () => {
    const { session } = aggregateAdapterResult(
      {
        header: { native_session_id: 's', agent: 'claude_code', agent_version: null, project_path: '/p', started_at: 't0', ended_at: 't1', agent_reported_cost_usd: null, metadata: {} },
        turns: [
          { native_turn_id: 'a', sequence: 0, timestamp: 't0', model: 'claude-opus-4-7', model_raw: 'x', fresh_input_tokens: 100, output_tokens: 100, cache_read_tokens: 0, cache_write_tokens: 0, cache_write_5m_tokens: null, cache_write_1h_tokens: null, tool_calls_count: 0, metadata: {} },
          { native_turn_id: 'b', sequence: 1, timestamp: 't1', model: 'claude-haiku-4-5', model_raw: 'x', fresh_input_tokens: 1000, output_tokens: 1000, cache_read_tokens: 0, cache_write_tokens: 0, cache_write_5m_tokens: null, cache_write_1h_tokens: null, tool_calls_count: 0, metadata: {} },
        ],
        parse_errors: [],
      },
      TABLE
    );
    expect(session.primary_model).toBe('claude-haiku-4-5');
  });
});
