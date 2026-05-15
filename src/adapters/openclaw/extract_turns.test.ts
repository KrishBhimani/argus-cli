import { describe, it, expect } from 'vitest';
import { extractOpenClawTurns } from './extract_turns.js';

describe('extractOpenClawTurns', () => {
  it('returns one RawTurnEvent per assistant message with usage', () => {
    const lines = [
      { type: 'session', id: 'sid', timestamp: '2026-05-08T00:00:00Z', cwd: '/proj' },
      { type: 'model_change', id: 'm1', timestamp: '2026-05-08T00:00:00Z', provider: 'kimi', modelId: 'kimi-code' },
      { type: 'message', id: 'u1', timestamp: '2026-05-08T00:00:01Z',
        message: { role: 'user', content: [{ type: 'text', text: 'hi' }] } },
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1', model: 'kimi-code', provider: 'kimi', content: [],
          usage: { input: 100, output: 50, cacheRead: 10, cacheWrite: 0, cost: { total: 0.0125 } } } },
    ];
    const turns = extractOpenClawTurns(lines as any);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      native_turn_id: 'asst-1',
      sequence: 0,
      timestamp: '2026-05-08T00:00:02Z',
      model: 'kimi-code',
      model_raw: 'kimi-code',
      fresh_input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 10,
      cache_write_tokens: 0,
      cost_usd_override: 0.0125,
      provider: 'kimi',
    });
  });

  it('buffers active provider from model_change events when message omits provider', () => {
    const lines = [
      { type: 'session', id: 'sid', timestamp: '2026-05-08T00:00:00Z', cwd: '/proj' },
      { type: 'model_change', id: 'm1', timestamp: '2026-05-08T00:00:00Z', provider: 'kimi', modelId: 'kimi-code' },
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1', content: [],
          usage: { input: 10, output: 5, cost: 0.001 } } },
      { type: 'model_change', id: 'm2', timestamp: '2026-05-08T00:00:03Z', provider: 'openai', modelId: 'gpt-5' },
      { type: 'message', id: 'a2', timestamp: '2026-05-08T00:00:04Z',
        message: { role: 'assistant', id: 'asst-2', content: [],
          usage: { input: 20, output: 10, cost: 0.002 } } },
    ];
    const turns = extractOpenClawTurns(lines as any);
    expect(turns).toHaveLength(2);
    expect(turns[0].provider).toBe('kimi');
    expect(turns[0].model_raw).toBe('kimi-code');
    expect(turns[1].provider).toBe('openai');
    expect(turns[1].model_raw).toBe('gpt-5');
  });

  it('skips assistant messages without usage', () => {
    const lines = [
      { type: 'session', id: 'sid', timestamp: '2026-05-08T00:00:00Z', cwd: '/proj' },
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1', content: [] } },
    ];
    const turns = extractOpenClawTurns(lines as any);
    expect(turns).toHaveLength(0);
  });

  it('handles missing cost (returns null override)', () => {
    const lines = [
      { type: 'session', id: 'sid', timestamp: '2026-05-08T00:00:00Z', cwd: '/proj' },
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1', content: [],
          usage: { input: 10, output: 5 } } },
    ];
    const turns = extractOpenClawTurns(lines as any);
    expect(turns).toHaveLength(1);
    expect(turns[0].cost_usd_override).toBeNull();
  });

  it('sequences turns 0..N-1 in record order', () => {
    const lines = [
      { type: 'session', id: 'sid', timestamp: '2026-05-08T00:00:00Z', cwd: '/proj' },
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:01Z',
        message: { role: 'assistant', id: 'asst-1', content: [], usage: { input: 1, output: 1, cost: 0 } } },
      { type: 'message', id: 'a2', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-2', content: [], usage: { input: 1, output: 1, cost: 0 } } },
      { type: 'message', id: 'a3', timestamp: '2026-05-08T00:00:03Z',
        message: { role: 'assistant', id: 'asst-3', content: [], usage: { input: 1, output: 1, cost: 0 } } },
    ];
    const turns = extractOpenClawTurns(lines as any);
    expect(turns.map(t => t.sequence)).toEqual([0, 1, 2]);
  });

  it('counts toolCall blocks toward tool_calls_count', () => {
    const lines = [
      { type: 'session', id: 'sid', timestamp: '2026-05-08T00:00:00Z', cwd: '/proj' },
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1',
          content: [
            { type: 'thinking', thinking: '...' },
            { type: 'toolCall', id: 'tc-1', name: 'read' },
            { type: 'toolCall', id: 'tc-2', name: 'write' },
          ],
          usage: { input: 10, output: 5, cost: 0 } } },
    ];
    const turns = extractOpenClawTurns(lines as any);
    expect(turns[0].tool_calls_count).toBe(2);
  });
});
