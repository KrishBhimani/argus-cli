import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './db.js';
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('openDb', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'argus-')); });

  it('creates schema on first open', () => {
    const db = openDb(join(dir, 'argus.db'));
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain('sessions');
    expect(names).toContain('turns');
    expect(names).toContain('file_offsets');
    expect(names).toContain('parse_errors');
    expect(names).toContain('app_meta');
    db.close();
  });

  it('enables WAL mode', () => {
    const db = openDb(join(dir, 'argus.db'));
    const r = db.pragma('journal_mode', { simple: true });
    expect(r).toBe('wal');
    db.close();
  });

  it('is idempotent', () => {
    const path = join(dir, 'argus.db');
    openDb(path).close();
    expect(() => openDb(path).close()).not.toThrow();
  });
});
