import { describe, it, expect } from 'vitest';
import { canonicalizeClaudeModel } from './model.js';

describe('canonicalizeClaudeModel', () => {
  it('passes alias forms through', () => {
    expect(canonicalizeClaudeModel('claude-opus-4-7')).toBe('claude-opus-4-7');
    expect(canonicalizeClaudeModel('claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
    expect(canonicalizeClaudeModel('claude-haiku-4-5')).toBe('claude-haiku-4-5');
  });

  it('strips date suffix from dated forms', () => {
    expect(canonicalizeClaudeModel('claude-opus-4-5-20251101')).toBe('claude-opus-4-5');
    expect(canonicalizeClaudeModel('claude-sonnet-4-5-20251022')).toBe('claude-sonnet-4-5');
    expect(canonicalizeClaudeModel('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5');
  });

  it('returns raw for unknown', () => {
    expect(canonicalizeClaudeModel('claude-experiment-x')).toBe('claude-experiment-x');
  });
});
