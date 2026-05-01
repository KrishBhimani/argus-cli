import { describe, it, expect } from 'vitest';
import { computeTurnCost } from './compute.js';
import type { PricingTable } from './types.js';

const TABLE: PricingTable = {
  version: '2026-05-02',
  models: {
    'claude-opus-4-7': { input: 5, output: 25, cache_write_5m: 6.25, cache_write_1h: 10, cache_read: 0.50 },
    'gpt-5.3-codex': { input: 1.75, output: 14, cache_read: 0.175 },
  },
};

describe('computeTurnCost', () => {
  it('Anthropic with 5m+1h cache writes', () => {
    const cost = computeTurnCost({
      model: 'claude-opus-4-7',
      fresh_input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_tokens: 1_000_000,
      cache_write_tokens: 1_000_000,
      cache_write_5m_tokens: 700_000,
      cache_write_1h_tokens: 300_000,
    }, TABLE);
    const expected = 5 + 25 + 0.50 + (0.7 * 6.25) + (0.3 * 10);
    expect(cost).toBeCloseTo(expected, 4);
  });

  it('Anthropic without tier breakdown falls back to 5m rate', () => {
    const cost = computeTurnCost({
      model: 'claude-opus-4-7',
      fresh_input_tokens: 0, output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 1_000_000,
      cache_write_5m_tokens: null, cache_write_1h_tokens: null,
    }, TABLE);
    expect(cost).toBeCloseTo(6.25, 4);
  });

  it('OpenAI with cached input only', () => {
    const cost = computeTurnCost({
      model: 'gpt-5.3-codex',
      fresh_input_tokens: 1_000_000, output_tokens: 1_000_000,
      cache_read_tokens: 500_000, cache_write_tokens: 0,
      cache_write_5m_tokens: null, cache_write_1h_tokens: null,
    }, TABLE);
    expect(cost).toBeCloseTo(1.75 + 14 + 0.5 * 0.175, 4);
  });

  it('returns 0 for unknown model', () => {
    const cost = computeTurnCost({
      model: 'fake', fresh_input_tokens: 1, output_tokens: 1,
      cache_read_tokens: 0, cache_write_tokens: 0,
      cache_write_5m_tokens: null, cache_write_1h_tokens: null,
    }, TABLE);
    expect(cost).toBe(0);
  });
});
