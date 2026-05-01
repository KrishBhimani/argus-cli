import { describe, it, expect } from 'vitest';
import { CodexAdapter } from './index.js';

const REAL = process.env.ARGUS_REAL_CODEX_ROOT;

describe.skipIf(!REAL)('CodexAdapter (real fixture)', () => {
  it('discovers Codex session files in real root', async () => {
    const a = new CodexAdapter(REAL!);
    const files = await a.discoverSessionFiles();
    expect(files.length).toBeGreaterThan(0);
  });

  it('ingests a real session', async () => {
    const a = new CodexAdapter(REAL!);
    const files = await a.discoverSessionFiles();
    const { result } = await a.ingestFile(files[0]);
    expect(result.header.agent).toBe('codex');
  });
});
