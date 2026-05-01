import { describe, it, expect } from 'vitest';
import { EnvelopeLineSchema, LegacyLineSchema, isEnvelope } from './schemas.js';

describe('Codex schemas', () => {
  it('parses an envelope session_meta line', () => {
    const line = { timestamp: '2026-05-01T00:00:00Z', type: 'session_meta', payload: { id: 'sess-uuid', timestamp: '2026-05-01T00:00:00Z', cwd: '/p', originator: 'codex_cli', cli_version: '0.45.0', instructions: '', source: '', git: {} } };
    expect(() => EnvelopeLineSchema.parse(line)).not.toThrow();
  });

  it('parses a token_count event_msg', () => {
    const line = { timestamp: '2026-05-01T00:00:01Z', type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 20, output_tokens: 50, reasoning_output_tokens: 10, total_tokens: 180 }, last_token_usage: { input_tokens: 50, cached_input_tokens: 10, output_tokens: 25, reasoning_output_tokens: 5, total_tokens: 90 }, model_context_window: 200000 } } };
    expect(() => EnvelopeLineSchema.parse(line)).not.toThrow();
  });

  it('parses a turn_context line', () => {
    const line = { timestamp: '2026-05-01T00:00:00Z', type: 'turn_context', payload: { cwd: '/p', approval_policy: 'auto', sandbox_policy: { mode: 'workspace_write', writable_roots: [], network_access: false }, model: 'gpt-5.3-codex', effort: 'high', summary: '' } };
    expect(() => EnvelopeLineSchema.parse(line)).not.toThrow();
  });

  it('parses a legacy bare line', () => {
    const line = { id: 'sess-uuid', timestamp: '2025-09-04T04:02:54Z', instructions: 'do stuff' };
    expect(() => LegacyLineSchema.parse(line)).not.toThrow();
  });

  it('isEnvelope distinguishes by shape', () => {
    expect(isEnvelope({ timestamp: 't', type: 'session_meta', payload: {} })).toBe(true);
    expect(isEnvelope({ id: 'x', timestamp: 't' })).toBe(false);
  });
});
