import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../store/db.js';
import { Repository } from '../store/repository.js';
import { startServer } from './server.js';

describe('startServer', () => {
  it('serves API and static dashboard from same port', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'argus-'));
    const dist = join(dir, 'dashboard-dist');
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<html><body>OK</body></html>');
    const repo = new Repository(openDb(join(dir, 'argus.db')));
    const { url, stop } = await startServer(repo, { pricingTableVersion: 'v1', ingestStatus: () => ({ foregroundComplete: true, pending: 0, processed: 0, total: 0 }), dashboardDir: dist, port: 0 });
    const idx = await fetch(url + '/');
    expect(idx.status).toBe(200);
    expect(await idx.text()).toContain('OK');
    const api = await fetch(url + '/api/sessions');
    expect(api.status).toBe(200);
    await stop();
  });
});
