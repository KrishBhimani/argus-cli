import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../store/db.js';
import { Repository } from '../store/repository.js';
import { ClaudeCodeAdapter } from '../adapters/claude_code/index.js';
import { ingestFile } from './pipeline.js';
import { loadPricingTable } from '../pricing/load.js';

describe('ingestFile pipeline', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'argus-')); });

  it('ingests a synthetic Claude Code session end-to-end', async () => {
    const claudeRoot = join(dir, '.claude');
    const proj = join(claudeRoot, 'projects', 'C--proj');
    mkdirSync(proj, { recursive: true });
    const sessionFile = join(proj, 'sess1.jsonl');
    writeFileSync(sessionFile, JSON.stringify({
      type: 'assistant', sessionId: 'sess1', uuid: 'u1', timestamp: '2026-05-01T00:00:00Z',
      cwd: 'C:/proj', version: '2.1.94', userType: 'external', entrypoint: 'cli',
      message: { id: 'm1', model: 'claude-opus-4-7', role: 'assistant', content: [], usage: { input_tokens: 1000, output_tokens: 2000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    }) + '\n');

    const db = openDb(join(dir, 'argus.db'));
    const repo = new Repository(db);
    const adapter = new ClaudeCodeAdapter(claudeRoot);
    const table = await loadPricingTable();

    await ingestFile(adapter, sessionFile, repo, table);
    const list = repo.listSessions({ limit: 10 });
    expect(list).toHaveLength(1);
    expect(list[0].agent).toBe('claude_code');
    expect(list[0].total_fresh_input_tokens).toBe(1000);
    expect(list[0].total_cost_usd).toBeGreaterThan(0);
    expect(repo.getFileOffset(sessionFile)).toBeGreaterThan(0);
  });
});
