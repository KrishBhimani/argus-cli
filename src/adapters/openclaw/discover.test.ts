import { describe, it, expect } from 'vitest';
import { openclawSessionIdFromFilename } from './discover.js';

describe('openclawSessionIdFromFilename', () => {
  it('returns base id for a plain .jsonl', () => {
    expect(openclawSessionIdFromFilename('abc123.jsonl')).toBe('abc123');
  });

  it('returns base id for a .jsonl.reset.<iso> archive', () => {
    expect(openclawSessionIdFromFilename('abc123.jsonl.reset.2026-04-16T14-08-20.015Z'))
      .toBe('abc123');
  });

  it('returns base id for a .jsonl.deleted.<iso> archive', () => {
    expect(openclawSessionIdFromFilename('abc123.jsonl.deleted.2026-04-16T14-08-20.015Z'))
      .toBe('abc123');
  });

  it('skips .jsonl.bak.<iso>', () => {
    expect(openclawSessionIdFromFilename('abc123.jsonl.bak.2026-05-01T00-00-00.000Z'))
      .toBeNull();
  });

  it('skips *.checkpoint.<uuid>.jsonl', () => {
    expect(openclawSessionIdFromFilename('abc123.checkpoint.deadbeef.jsonl'))
      .toBeNull();
  });

  it('skips files that are not .jsonl', () => {
    expect(openclawSessionIdFromFilename('abc123.txt')).toBeNull();
    expect(openclawSessionIdFromFilename('README.md')).toBeNull();
  });

  it('skips empty / weird names', () => {
    expect(openclawSessionIdFromFilename('')).toBeNull();
    expect(openclawSessionIdFromFilename('.jsonl')).toBeNull();
  });
});
