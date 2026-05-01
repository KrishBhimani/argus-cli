import type { Adapter } from '../adapter.js';
import { discoverSessionFiles, subAgentFilesFor } from './discover.js';
import { ingestClaudeCodeFile } from './ingest_file.js';

export class ClaudeCodeAdapter implements Adapter {
  readonly agent = 'claude_code' as const;
  constructor(private readonly root: string) {}
  rootPath() { return this.root; }
  async discoverSessionFiles() {
    const top = await discoverSessionFiles(this.root);
    const subs = top.flatMap(subAgentFilesFor);
    return [...top, ...subs];
  }
  async ingestFile(filePath: string, fromOffset = 0) {
    return ingestClaudeCodeFile(filePath, fromOffset);
  }
}
