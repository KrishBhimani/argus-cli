import { describe, it, expect } from 'vitest';
import { extractTurns } from './extract_turns.js';
import type { AssistantLine } from './schemas.js';

const mkLine = (msgId: string, seq: number, usage = { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, contentType = 'text'): AssistantLine => ({
  type: 'assistant',
  sessionId: 's1', uuid: `u${seq}`, timestamp: `2026-05-01T00:00:0${seq}Z`, cwd: '/p', version: '2.1.94',
  message: {
    id: msgId, model: 'claude-opus-4-7', role: 'assistant',
    content: [{ type: contentType as any, text: 'x' }],
    usage,
  } as any,
});

describe('extractTurns', () => {
  it('dedupes by message.id', () => {
    const lines = [mkLine('m1', 0), mkLine('m1', 1), mkLine('m2', 2)];
    const turns = extractTurns(lines);
    expect(turns).toHaveLength(2);
    expect(turns[0].native_turn_id).toBe('m1');
    expect(turns[1].native_turn_id).toBe('m2');
  });

  it('counts tool_use blocks across deduped lines', () => {
    const a = mkLine('m1', 0, undefined, 'text');
    const b = { ...mkLine('m1', 1), message: { ...mkLine('m1', 1).message, content: [{ type: 'tool_use', id: 't1', name: 'Bash' }] } } as any;
    const turns = extractTurns([a, b]);
    expect(turns).toHaveLength(1);
    expect(turns[0].tool_calls_count).toBe(1);
  });

  it('maps cache fields correctly', () => {
    const line = mkLine('m1', 0, { input_tokens: 100, output_tokens: 200, cache_read_input_tokens: 50, cache_creation_input_tokens: 30 });
    const turns = extractTurns([line]);
    expect(turns[0].fresh_input_tokens).toBe(100);
    expect(turns[0].cache_read_tokens).toBe(50);
    expect(turns[0].cache_write_tokens).toBe(30);
  });

  it('extracts 5m/1h tier breakdown when present', () => {
    const line = {
      ...mkLine('m1', 0),
      message: {
        ...mkLine('m1', 0).message,
        usage: {
          input_tokens: 100, output_tokens: 200,
          cache_read_input_tokens: 50, cache_creation_input_tokens: 10,
          cache_creation: { ephemeral_5m_input_tokens: 7, ephemeral_1h_input_tokens: 3 },
        },
      },
    } as any;
    const turns = extractTurns([line]);
    expect(turns[0].cache_write_5m_tokens).toBe(7);
    expect(turns[0].cache_write_1h_tokens).toBe(3);
  });
});
