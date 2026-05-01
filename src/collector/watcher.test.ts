import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../store/db.js';
import { Repository } from '../store/repository.js';
import { ClaudeCodeAdapter } from '../adapters/claude_code/index.js';
import { startWatcher } from './watcher.js';
import { loadPricingTable } from '../pricing/load.js';

const ASSISTANT = (sid: string, uid: string, mid: string) => JSON.stringify({
  type: 'assistant', sessionId: sid, uuid: uid, timestamp: '2026-05-01T00:00:00Z',
  cwd: 'C:/proj', version: '2.1.94', userType: 'external', entrypoint: 'cli',
  message: { id: mid, model: 'claude-opus-4-7', role: 'assistant', content: [], usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
});

describe('startWatcher', () => {
  let dir: string;
  let stop: (() => Promise<void>) | null = null;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'argus-')); });
  afterEach(async () => { if (stop) await stop(); stop = null; });

  it('picks up appended lines after start', async () => {
    const claudeRoot = join(dir, '.claude');
    const proj = join(claudeRoot, 'projects', 'C--proj');
    mkdirSync(proj, { recursive: true });
    const f = join(proj, 's1.jsonl');
    writeFileSync(f, ASSISTANT('s1', 'u1', 'm1') + '\n');

    const db = openDb(join(dir, 'argus.db'));
    const repo = new Repository(db);
    const adapter = new ClaudeCodeAdapter(claudeRoot);
    const table = await loadPricingTable();

    stop = await startWatcher([adapter], repo, table, { stabilityThresholdMs: 50 });
    await new Promise(r => setTimeout(r, 200));

    appendFileSync(f, ASSISTANT('s1', 'u2', 'm2') + '\n');
    await new Promise(r => setTimeout(r, 400));

    const turns = repo.getTurnsForSession('claude_code:s1');
    expect(turns.length).toBe(2);
  });
});
