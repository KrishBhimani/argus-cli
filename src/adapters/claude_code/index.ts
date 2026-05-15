import type { Adapter, AdapterCapabilities } from '../adapter.js';
import { discoverSessionFiles } from './discover.js';
import { ingestClaudeCodeFile } from './ingest_file.js';

export class ClaudeCodeAdapter implements Adapter {
  readonly agent = 'claude_code';
  readonly displayName = 'Claude Code';
  readonly capabilities: AdapterCapabilities = {
    reportsNativeCost: false,
    hasToolCalls: true,
    hasTranscriptSegments: true,
    hasPrompts: true,
  };
  constructor(private readonly root: string) {}
  rootPath() { return this.root; }
  // Only top-level session files. Sub-agent files (<sid>/subagents/*.jsonl)
  // are processed by the pipeline as a rollup under their parent session;
  // they MUST NOT appear in this list or they'd be counted twice (once as
  // their own session, once as a sub-session under the parent).
  async discoverSessionFiles() {
    return discoverSessionFiles(this.root);
  }
  async ingestFile(filePath: string, fromOffset = 0) {
    return ingestClaudeCodeFile(filePath, fromOffset);
  }
}
