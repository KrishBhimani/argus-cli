import { describe, it, expect } from 'vitest';
import { AssistantLineSchema, UserLineSchema } from './schemas.js';

describe('Claude Code line schemas', () => {
  it('parses an assistant line with usage', () => {
    const line = {
      type: 'assistant', sessionId: 's1', uuid: 'u1', timestamp: '2026-05-01T00:00:00Z',
      cwd: 'C:/proj', version: '2.1.94', userType: 'external', entrypoint: 'cli',
      message: {
        id: 'msg_abc', model: 'claude-opus-4-7', role: 'assistant',
        content: [{ type: 'text', text: '...' }, { type: 'tool_use', id: 't1', name: 'Bash', input: {} }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: 2 },
      },
    };
    const parsed = AssistantLineSchema.parse(line);
    expect(parsed.message.usage.input_tokens).toBe(10);
  });

  it('accepts assistant line with cache_creation tier breakdown', () => {
    const line = {
      type: 'assistant', sessionId: 's1', uuid: 'u1', timestamp: '2026-05-01T00:00:00Z',
      cwd: 'C:/proj', version: '2.1.121', userType: 'external', entrypoint: 'cli',
      message: {
        id: 'msg_abc', model: 'claude-opus-4-7', role: 'assistant', content: [],
        usage: {
          input_tokens: 10, output_tokens: 20,
          cache_read_input_tokens: 5, cache_creation_input_tokens: 7,
          cache_creation: { ephemeral_5m_input_tokens: 4, ephemeral_1h_input_tokens: 3 },
        },
      },
    };
    expect(() => AssistantLineSchema.parse(line)).not.toThrow();
  });

  it('parses a user line', () => {
    const line = {
      type: 'user', sessionId: 's1', uuid: 'u1', timestamp: '2026-05-01T00:00:00Z',
      cwd: 'C:/proj', version: '2.1.94', userType: 'external', entrypoint: 'cli',
      message: { role: 'user', content: 'hello' },
    };
    expect(() => UserLineSchema.parse(line)).not.toThrow();
  });

  it('passthrough preserves unknown fields', () => {
    const line = {
      type: 'assistant', sessionId: 's1', uuid: 'u1', timestamp: '2026-05-01T00:00:00Z',
      cwd: 'C:/proj', version: '2.1.94', userType: 'external', entrypoint: 'cli',
      attribution_agent: 'general-purpose', isSidechain: true, agentId: 'a-xyz',
      message: { id: 'msg', model: 'claude-opus-4-7', role: 'assistant', content: [], usage: { input_tokens: 1, output_tokens: 1 } },
    };
    const parsed = AssistantLineSchema.parse(line);
    expect((parsed as any).attribution_agent).toBe('general-purpose');
  });
});
