import { describe, it, expect, vi } from 'vitest';
import { diffPricing, fetchLiteLlmTable } from './refresh.js';

describe('diffPricing', () => {
  it('detects added, removed, and changed models', () => {
    const oldT = { version: 'a', models: { keep: { input: 1, output: 2, cache_read: 0 }, remove: { input: 1, output: 2, cache_read: 0 }, change: { input: 1, output: 2, cache_read: 0 } } };
    const newT = { version: 'b', models: { keep: { input: 1, output: 2, cache_read: 0 }, change: { input: 5, output: 2, cache_read: 0 }, add: { input: 1, output: 2, cache_read: 0 } } };
    const diff = diffPricing(oldT as any, newT as any);
    expect(diff.added).toEqual(['add']);
    expect(diff.removed).toEqual(['remove']);
    expect(diff.changed).toEqual(['change']);
    expect(diff.unchanged).toEqual(['keep']);
  });
});

describe('fetchLiteLlmTable', () => {
  it('parses LiteLLM JSON into PricingTable shape', async () => {
    const sample = {
      'claude-opus-4-7': { input_cost_per_token: 0.000005, output_cost_per_token: 0.000025, cache_read_input_token_cost: 0.0000005, cache_creation_input_token_cost: 0.00000625 },
      'gpt-5.3-codex': { input_cost_per_token: 0.00000175, output_cost_per_token: 0.000014, cache_read_input_token_cost: 0.000000175 },
      'sample_spec': {},
    };
    const stub = vi.fn().mockResolvedValue({ ok: true, json: async () => sample });
    vi.stubGlobal('fetch', stub);
    const t = await fetchLiteLlmTable('https://x');
    expect(t.models['claude-opus-4-7'].input).toBeCloseTo(5, 4);
    expect(t.models['gpt-5.3-codex'].cache_read).toBeCloseTo(0.175, 4);
    expect(t.models['sample_spec']).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
