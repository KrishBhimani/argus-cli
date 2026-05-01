import type { Adapter } from '../adapter.js';
import { discoverCodexSessionFiles } from './discover.js';
import { ingestCodexFile } from './ingest_file.js';

export class CodexAdapter implements Adapter {
  readonly agent = 'codex' as const;
  constructor(private readonly root: string) {}
  rootPath() { return this.root; }
  async discoverSessionFiles() { return discoverCodexSessionFiles(this.root); }
  async ingestFile(p: string, off = 0) { return ingestCodexFile(p, off); }
}
