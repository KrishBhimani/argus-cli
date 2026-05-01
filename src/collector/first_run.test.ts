import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../store/db.js';
import { Repository } from '../store/repository.js';
import { ClaudeCodeAdapter } from '../adapters/claude_code/index.js';
import { runFirstPassIngest } from './first_run.js';
import { loadPricingTable } from '../pricing/load.js';

describe('runFirstPassIngest', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'argus-')); });

  it('ingests recent files in foreground, older files in background', async () => {
    const claudeRoot = join(dir, '.claude');
    const proj = join(claudeRoot, 'projects', 'C--proj');
    mkdirSync(proj, { recursive: true });
    const recent = join(proj, 'recent.jsonl');
    const old = join(proj, 'old.jsonl');
    const line = (sid: string, mid: string, ts: string) => JSON.stringify({
      type: 'assistant', sessionId: sid, uuid: 'u', timestamp: ts,
      cwd: 'C:/proj', version: '2.1.94', userType: 'external', entrypoint: 'cli',
      message: { id: mid, model: 'claude-opus-4-7', role: 'assistant', content: [], usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    }) + '\n';
    writeFileSync(recent, line('rec', 'mr', new Date().toISOString()));
    writeFileSync(old, line('old', 'mo', '2025-01-01T00:00:00Z'));

    const oldT = new Date('2025-01-01').getTime() / 1000;
    utimesSync(old, oldT, oldT);

    const db = openDb(join(dir, 'argus.db'));
    const repo = new Repository(db);
    const adapter = new ClaudeCodeAdapter(claudeRoot);
    const table = await loadPricingTable();

    const { foregroundDone, backfillDone, status } = runFirstPassIngest([adapter], repo, table, { recentDays: 30 });
    await foregroundDone;
    expect(repo.listSessions({ limit: 10 }).map(s => s.id).sort()).toEqual(['claude_code:recent']);
    expect(status().total).toBe(2);
    await backfillDone;
    expect(repo.listSessions({ limit: 10 }).map(s => s.id).sort()).toEqual(['claude_code:old', 'claude_code:recent']);
    expect(status().pending).toBe(0);
    expect(status().processed).toBe(2);
  });
});
