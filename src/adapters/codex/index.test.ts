import { describe, it, expect } from 'vitest';
import { CodexAdapter } from './index.js';

describe('CodexAdapter', () => {
  it('exposes codex as agent name', () => {
    const a = new CodexAdapter('/tmp/.codex');
    expect(a.agent).toBe('codex');
  });
});
