import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAdapters } from './registry.js';

describe('loadAdapters', () => {
  it('returns nothing when neither root exists', () => {
    const home = mkdtempSync(join(tmpdir(), 'home-'));
    expect(loadAdapters(home)).toHaveLength(0);
  });

  it('registers ClaudeCodeAdapter when ~/.claude exists', () => {
    const home = mkdtempSync(join(tmpdir(), 'home-'));
    mkdirSync(join(home, '.claude'));
    const adapters = loadAdapters(home);
    expect(adapters.map(a => a.agent)).toContain('claude_code');
  });

  it('registers OpenClawAdapter when ~/.openclaw exists', () => {
    const home = mkdtempSync(join(tmpdir(), 'home-'));
    mkdirSync(join(home, '.openclaw'));
    const adapters = loadAdapters(home);
    expect(adapters.map(a => a.agent)).toContain('openclaw');
  });

  it('registers both when both exist', () => {
    const home = mkdtempSync(join(tmpdir(), 'home-'));
    mkdirSync(join(home, '.claude'));
    mkdirSync(join(home, '.openclaw'));
    const adapters = loadAdapters(home);
    expect(adapters.map(a => a.agent).sort()).toEqual(['claude_code', 'openclaw']);
  });
});
