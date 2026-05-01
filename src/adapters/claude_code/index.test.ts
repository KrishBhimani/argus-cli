import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from './index.js';

describe('ClaudeCodeAdapter', () => {
  it('exposes claude_code as agent name', () => {
    const a = new ClaudeCodeAdapter('/tmp/.claude');
    expect(a.agent).toBe('claude_code');
    expect(a.rootPath()).toBe('/tmp/.claude');
  });
});
