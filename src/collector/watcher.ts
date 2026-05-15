import chokidar, { type FSWatcher } from 'chokidar';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Adapter } from '../adapters/adapter.js';
import type { Repository } from '../store/repository.js';
import type { PricingTable } from '../pricing/types.js';
import { ingestFile } from './pipeline.js';
import { ingestHistoryFile } from '../adapters/claude_code/history_jsonl.js';

export interface WatcherOpts { stabilityThresholdMs?: number; }

export async function startWatcher(adapters: Adapter[], repo: Repository, table: PricingTable, opts: WatcherOpts = {}): Promise<() => Promise<void>> {
  const watchers: FSWatcher[] = [];
  for (const a of adapters) {
    const root = a.rootPath();
    const w = chokidar.watch(root, {
      persistent: true,
      ignoreInitial: false,
      // Don't follow symlinks. A hostile or accidental link planted in
      // ~/.claude/projects/ pointing to /etc/passwd or ~/.ssh/* would
      // otherwise be parsed and have its first 200 bytes per line stored
      // as parse_errors (then served via /api/parse-errors).
      followSymlinks: false,
      awaitWriteFinish: { stabilityThreshold: opts.stabilityThresholdMs ?? 100, pollInterval: 30 },
    });
    const handle = async (p: string) => {
      // Adapters can override the filter rule. Default (used by ClaudeCodeAdapter)
      // is "ends with .jsonl AND not under subagents/" — sub-agent files are only
      // processed as a rollup under their parent session, never standalone.
      const accept = a.shouldIngestPath
        ? a.shouldIngestPath(p)
        : (p.endsWith('.jsonl') && !p.includes('subagents'));
      if (!accept) return;
      try { await ingestFile(a, p, repo, table); }
      catch (e) { repo.recordParseError({ file: p, byte_offset: -1, reason: e instanceof Error ? e.message : String(e), raw_line_truncated: '' }); }
    };
    w.on('add', handle).on('change', handle);
    watchers.push(w);

    // Slice 1: also watch the global ~/.claude/history.jsonl for the
    // Prompts page. The adapter's root is ~/.claude for the claude_code
    // adapter, so the file lives directly under it.
    if (a.agent === 'claude_code') {
      const historyPath = join(root, 'history.jsonl');
      if (existsSync(historyPath)) {
        const hw = chokidar.watch(historyPath, {
          persistent: true,
          ignoreInitial: false,
          followSymlinks: false,
          awaitWriteFinish: { stabilityThreshold: opts.stabilityThresholdMs ?? 100, pollInterval: 30 },
        });
        const histHandle = async () => {
          try { await ingestHistoryFile(historyPath, repo); }
          catch (e) {
            repo.recordParseError({
              file: historyPath, byte_offset: -1,
              reason: `[history] ${e instanceof Error ? e.message : String(e)}`,
              raw_line_truncated: '',
            });
          }
        };
        hw.on('add', histHandle).on('change', histHandle);
        watchers.push(hw);
      }
    }
  }
  return async () => { await Promise.all(watchers.map(w => w.close())); };
}
