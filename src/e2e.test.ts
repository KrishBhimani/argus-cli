import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from './store/db.js';
import { Repository } from './store/repository.js';
import { ClaudeCodeAdapter } from './adapters/claude_code/index.js';
import { runFirstPassIngest } from './collector/first_run.js';
import { startServer } from './server/server.js';
import { loadPricingTable } from './pricing/load.js';

describe('Argus end-to-end', () => {
  it('ingests a synthetic session and serves it via API', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'argus-e2e-'));
    const claudeRoot = join(dir, '.claude');
    const proj = join(claudeRoot, 'projects', 'C--p');
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, 's.jsonl'), JSON.stringify({
      type: 'assistant', sessionId: 's', uuid: 'u', timestamp: new Date().toISOString(),
      cwd: 'C:/p', version: '2.1.94', userType: 'external', entrypoint: 'cli',
      message: { id: 'm', model: 'claude-opus-4-7', role: 'assistant', content: [], usage: { input_tokens: 1000, output_tokens: 2000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    }) + '\n');

    const db = openDb(join(dir, 'argus.db'));
    const repo = new Repository(db);
    const adapter = new ClaudeCodeAdapter(claudeRoot);
    const table = await loadPricingTable();
    const { foregroundDone, status } = runFirstPassIngest([adapter], repo, table, { recentDays: 30 });
    await foregroundDone;

    const dashDir = mkdtempSync(join(tmpdir(), 'argus-dash-'));
    writeFileSync(join(dashDir, 'index.html'), '<html><body>OK</body></html>');
    const { url, stop } = await startServer(repo, { pricingTableVersion: table.version, ingestStatus: status, dashboardDir: dashDir, port: 0 });
    try {
      const sessions = await (await fetch(url + '/api/sessions')).json();
      expect(sessions.sessions.length).toBe(1);
      expect(sessions.sessions[0].total_cost_usd).toBeGreaterThan(0);
      const overview = await (await fetch(url + '/api/overview?window=7d')).json();
      expect(overview.total_cost_usd).toBeGreaterThan(0);
    } finally { await stop(); }
  });
});
