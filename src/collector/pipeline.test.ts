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

  it('incremental re-ingest does NOT reduce session totals (regression: turn merging)', async () => {
    const { writeFileSync, appendFileSync } = await import('node:fs');
    const claudeRoot = join(dir, '.claude');
    const proj = join(claudeRoot, 'projects', 'C--proj');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(proj, { recursive: true });
    const f = join(proj, 'sess1.jsonl');

    const line = (msgId: string) => JSON.stringify({
      type: 'assistant', sessionId: 'sess1', uuid: 'u' + msgId, timestamp: '2026-05-01T00:00:00Z',
      cwd: 'C:/proj', version: '2.1.94', userType: 'external', entrypoint: 'cli',
      message: { id: msgId, model: 'claude-opus-4-7', role: 'assistant', content: [],
        usage: { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    }) + '\n';

    writeFileSync(f, line('m1') + line('m2') + line('m3'));

    const db = openDb(join(dir, 'argus.db'));
    const repo = new Repository(db);
    const adapter = new ClaudeCodeAdapter(claudeRoot);
    const table = await loadPricingTable();

    // First ingest: full file
    await ingestFile(adapter, f, repo, table);
    const after1 = repo.getSession('claude_code:sess1')!;
    expect(after1.turn_count).toBe(3);
    const cost1 = after1.total_cost_usd;
    expect(cost1).toBeGreaterThan(0);

    // Append one more turn — simulates an active session being written to
    appendFileSync(f, line('m4'));
    await ingestFile(adapter, f, repo, table);
    const after2 = repo.getSession('claude_code:sess1')!;
    expect(after2.turn_count).toBe(4);
    expect(after2.total_cost_usd).toBeGreaterThan(cost1); // MUST increase, not decrease

    // Re-ingest with no new content — totals must not change
    await ingestFile(adapter, f, repo, table);
    const after3 = repo.getSession('claude_code:sess1')!;
    expect(after3.turn_count).toBe(4);
    expect(after3.total_cost_usd).toBe(after2.total_cost_usd);
  });

  it('sub-agent files are NOT counted twice (regression: discoverSessionFiles + rollup)', async () => {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const claudeRoot = join(dir, '.claude');
    const proj = join(claudeRoot, 'projects', 'C--proj');
    mkdirSync(proj, { recursive: true });
    const parentFile = join(proj, 'parent.jsonl');
    const subDir = join(proj, 'parent', 'subagents');
    mkdirSync(subDir, { recursive: true });
    const subFile = join(subDir, 'agent-aabc.jsonl');

    const line = (sessionId: string, msgId: string, tokens: number) => JSON.stringify({
      type: 'assistant', sessionId, uuid: 'u' + msgId, timestamp: '2026-05-01T00:00:00Z',
      cwd: 'C:/proj', version: '2.1.94', userType: 'external', entrypoint: 'cli',
      message: { id: msgId, model: 'claude-opus-4-7', role: 'assistant', content: [],
        usage: { input_tokens: tokens, output_tokens: tokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    }) + '\n';

    writeFileSync(parentFile, line('parent', 'p1', 1_000_000) + line('parent', 'p2', 1_000_000));
    writeFileSync(subFile, line('parent', 's1', 500_000));

    const db = openDb(join(dir, 'argus.db'));
    const repo = new Repository(db);
    const adapter = new ClaudeCodeAdapter(claudeRoot);
    const table = await loadPricingTable();

    // Use the adapter's discover (NOT the lower-level discoverSessionFiles) — same path the CLI uses
    const files = await adapter.discoverSessionFiles();
    expect(files).toEqual([parentFile]); // sub-agent files MUST be excluded from discovery

    for (const f of files) await ingestFile(adapter, f, repo, table);

    const parent = repo.getSession('claude_code:parent')!;
    expect(parent).toBeDefined();
    // parent has 2 own turns (1M+1M each) plus sub-agent's 1 turn (500k+500k):
    // total fresh = 2*1M + 1*500k = 2.5M, total output = 2.5M
    expect(parent.total_fresh_input_tokens).toBe(2_500_000);
    expect(parent.total_output_tokens).toBe(2_500_000);
    // turn count includes sub-agent's turn(s) via rollup metadata, but the
    // headline figure should be 2 (parent's own) + 1 (sub) = 3
    expect(parent.turn_count).toBe(3);
  });

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
