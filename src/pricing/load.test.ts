import { describe, it, expect } from 'vitest';
import { loadPricingTable } from './load.js';

describe('loadPricingTable', () => {
  it('loads bundled pricing JSON', async () => {
    const t = await loadPricingTable();
    expect(t.version).toBe('2026-05-02');
    expect(t.models['claude-opus-4-7'].input).toBe(5);
    expect(t.models['gpt-5.3-codex'].output).toBe(14);
  });

  it('returns null pricing for unknown model', async () => {
    const t = await loadPricingTable();
    expect(t.models['fake-model']).toBeUndefined();
  });
});
