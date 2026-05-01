import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from './index.js';

const REAL = process.env.ARGUS_REAL_CLAUDE_ROOT;

describe.skipIf(!REAL)('ClaudeCodeAdapter (real fixture)', () => {
  it('discovers session files in real root', async () => {
    const a = new ClaudeCodeAdapter(REAL!);
    const files = await a.discoverSessionFiles();
    expect(files.length).toBeGreaterThan(0);
  });

  it('ingests a real session without parse errors > 5%', async () => {
    const a = new ClaudeCodeAdapter(REAL!);
    const files = (await a.discoverSessionFiles()).filter(f => !f.includes('subagents'));
    expect(files.length).toBeGreaterThan(0);
    const { result } = await a.ingestFile(files[0]);
    const lineCount = result.turns.length + result.parse_errors.length;
    if (lineCount > 0) {
      expect(result.parse_errors.length / lineCount).toBeLessThan(0.05);
    }
  });
});
