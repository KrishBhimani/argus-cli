import { describe, it, expect } from 'vitest';
import { extractCodexTurns } from './extract_turns.js';

const meta = (id: string, t: string, cwd = '/p') => ({ timestamp: t, type: 'session_meta', payload: { id, timestamp: t, cwd } });
const turn = (t: string, model: string) => ({ timestamp: t, type: 'turn_context', payload: { model, cwd: '/p' } });
const tokens = (t: string, total_in: number, cached: number, total_out: number, reasoning = 0) => ({
  timestamp: t, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: total_in, cached_input_tokens: cached, output_tokens: total_out, reasoning_output_tokens: reasoning, total_tokens: total_in + total_out } } }
});
const fnCall = (t: string) => ({ timestamp: t, type: 'response_item', payload: { type: 'function_call' } });

describe('extractCodexTurns', () => {
  it('computes per-turn deltas from cumulative snapshots', () => {
    const lines = [
      meta('sess1', '2026-05-01T00:00:00Z'),
      turn('2026-05-01T00:00:01Z', 'gpt-5.3-codex'),
      tokens('2026-05-01T00:00:02Z', 100, 20, 50),
      turn('2026-05-01T00:00:03Z', 'gpt-5.3-codex'),
      tokens('2026-05-01T00:00:04Z', 250, 60, 130),
    ];
    const { header, turns } = extractCodexTurns(lines as any);
    expect(turns.length).toBe(2);
    expect(turns[0].fresh_input_tokens).toBe(80);
    expect(turns[0].cache_read_tokens).toBe(20);
    expect(turns[0].output_tokens).toBe(50);
    expect(turns[1].fresh_input_tokens).toBe(150 - 40);
    expect(turns[1].cache_read_tokens).toBe(40);
    expect(turns[1].output_tokens).toBe(80);
    expect(header.native_session_id).toBe('sess1');
    expect(header.project_path).toBe('/p');
  });

  it('folds reasoning_output_tokens into output_tokens', () => {
    const lines = [
      meta('s', '2026-05-01T00:00:00Z'),
      turn('2026-05-01T00:00:01Z', 'gpt-5.3-codex'),
      tokens('2026-05-01T00:00:02Z', 100, 0, 30, 20),
    ];
    const { turns } = extractCodexTurns(lines as any);
    expect(turns[0].output_tokens).toBe(50);
    expect(turns[0].metadata.reasoning_output_tokens).toBe(20);
  });

  it('always reports cache_write_tokens = 0', () => {
    const lines = [
      meta('s', '2026-05-01T00:00:00Z'),
      turn('2026-05-01T00:00:01Z', 'gpt-5.3-codex'),
      tokens('2026-05-01T00:00:02Z', 10, 5, 5),
    ];
    const { turns } = extractCodexTurns(lines as any);
    expect(turns[0].cache_write_tokens).toBe(0);
    expect(turns[0].cache_write_5m_tokens).toBeNull();
    expect(turns[0].cache_write_1h_tokens).toBeNull();
  });

  it('counts function_call items per turn', () => {
    const lines = [
      meta('s', '2026-05-01T00:00:00Z'),
      turn('2026-05-01T00:00:01Z', 'gpt-5.3-codex'),
      fnCall('2026-05-01T00:00:01.5Z'),
      fnCall('2026-05-01T00:00:01.7Z'),
      tokens('2026-05-01T00:00:02Z', 10, 0, 5),
      turn('2026-05-01T00:00:03Z', 'gpt-5.3-codex'),
      fnCall('2026-05-01T00:00:03.5Z'),
      tokens('2026-05-01T00:00:04Z', 20, 0, 10),
    ];
    const { turns } = extractCodexTurns(lines as any);
    expect(turns[0].tool_calls_count).toBe(2);
    expect(turns[1].tool_calls_count).toBe(1);
  });
});
