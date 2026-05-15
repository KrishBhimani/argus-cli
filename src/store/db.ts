import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MIGRATION_001, MIGRATION_002, MIGRATION_003, MIGRATION_004 } from './migrations/inline.js';

export type Db = Database.Database;

const SCHEMA_VERSION = 4;

export function openDb(path: string): Db {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // MIGRATION_001 is fully idempotent (CREATE TABLE IF NOT EXISTS) so we
  // always run it. After this point app_meta is guaranteed to exist.
  db.exec(MIGRATION_001);

  // Versioned migrations: ALTER TABLE has no IF NOT EXISTS in SQLite, so we
  // gate later migrations on a schema_version row. Fresh DBs start at 1
  // (everything in MIGRATION_001 has been applied) and step up.
  const row = db.prepare(`SELECT value FROM app_meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  let current = row ? Number(row.value) : 1;

  if (current < 2) {
    db.exec(MIGRATION_002);
    current = 2;
  }
  if (current < 3) {
    db.exec(MIGRATION_003);
    current = 3;
  }
  if (current < 4) {
    db.exec(MIGRATION_004);
    current = 4;
  }

  db.prepare(`INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', ?)`).run(
    String(SCHEMA_VERSION),
  );

  return db;
}
