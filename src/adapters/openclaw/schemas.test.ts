import { describe, it, expect } from 'vitest';
import { SessionLineSchema, ModelChangeLineSchema, MessageLineSchema, normalizeCost } from './schemas.js';

describe('OpenClaw schemas', () => {
  it('parses a session header line', () => {
    const r = SessionLineSchema.parse({
      type: 'session',
      version: 3,
      id: 'abc123',
      timestamp: '2026-05-08T12:30:35.057Z',
      cwd: '/home/coder/.openclaw/workspace',
    });
    expect(r.id).toBe('abc123');
    expect(r.cwd).toBe('/home/coder/.openclaw/workspace');
  });

  it('parses a model_change line', () => {
    const r = ModelChangeLineSchema.parse({
      type: 'model_change',
      id: 'm1', parentId: null,
      timestamp: '2026-05-08T12:30:35.059Z',
      provider: 'kimi',
      modelId: 'kimi-code',
    });
    expect(r.provider).toBe('kimi');
    expect(r.modelId).toBe('kimi-code');
  });

  it('parses an assistant message with usage', () => {
    const r = MessageLineSchema.parse({
      type: 'message',
      id: 'a1',
      timestamp: '2026-05-08T12:30:40.000Z',
      message: {
        role: 'assistant',
        id: 'assistant-abc',
        model: 'kimi-code',
        provider: 'kimi',
        content: [],
        usage: { input: 100, output: 50, cacheRead: 10, cacheWrite: 0, cost: { total: 0.0125 } },
      },
    });
    expect(r.message.usage?.input).toBe(100);
    expect(r.message.usage?.output).toBe(50);
  });

  it('parses a user message with text content', () => {
    const r = MessageLineSchema.parse({
      type: 'message',
      id: 'u1',
      timestamp: '2026-05-08T12:30:35.057Z',
      message: { role: 'user', content: [{ type: 'text', text: 'hello' }] },
    });
    expect(r.message.role).toBe('user');
  });

  it('parses a toolResult message', () => {
    const r = MessageLineSchema.parse({
      type: 'message',
      id: 't1',
      timestamp: '2026-05-08T12:30:45.000Z',
      message: {
        role: 'toolResult',
        toolCallId: 'tc-1',
        toolName: 'read',
        content: [{ type: 'text', text: '...file contents...' }],
        isError: false,
      },
    });
    expect(r.message.toolCallId).toBe('tc-1');
    expect(r.message.isError).toBe(false);
  });

  describe('normalizeCost', () => {
    it('returns null for null/undefined', () => {
      expect(normalizeCost(null)).toBeNull();
      expect(normalizeCost(undefined)).toBeNull();
    });
    it('returns numeric value for a plain number', () => {
      expect(normalizeCost(0.0125)).toBe(0.0125);
      expect(normalizeCost(0)).toBe(0);
    });
    it('returns object.total when cost is an object', () => {
      expect(normalizeCost({ total: 0.05 })).toBe(0.05);
      expect(normalizeCost({ total: 0.05, input: 0.02, output: 0.03 })).toBe(0.05);
    });
    it('returns null for object without numeric total', () => {
      expect(normalizeCost({})).toBeNull();
      expect(normalizeCost({ total: 'oops' })).toBeNull();
    });
    it('returns null for non-finite numbers', () => {
      expect(normalizeCost(NaN)).toBeNull();
      expect(normalizeCost(Infinity)).toBeNull();
    });
  });
});
