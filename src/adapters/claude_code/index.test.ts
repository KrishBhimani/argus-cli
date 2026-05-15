import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from './index.js';

describe('ClaudeCodeAdapter', () => {
  it('exposes claude_code as agent name', () => {
    const a = new ClaudeCodeAdapter('/tmp/.claude');
    expect(a.agent).toBe('claude_code');
    expect(a.rootPath()).toBe('/tmp/.claude');
  });

  it('exposes a human display name', () => {
    const a = new ClaudeCodeAdapter('/tmp/.claude');
    expect(a.displayName).toBe('Claude Code');
  });

  it('declares its capabilities', () => {
    const a = new ClaudeCodeAdapter('/tmp/.claude');
    expect(a.capabilities).toEqual({
      reportsNativeCost: false,
      hasToolCalls: true,
      hasTranscriptSegments: true,
      hasPrompts: true,
    });
  });

  it('has no named-agent subdivision', async () => {
    const a = new ClaudeCodeAdapter('/tmp/.claude');
    expect(a.listBackendAgents).toBeUndefined();
  });
});
