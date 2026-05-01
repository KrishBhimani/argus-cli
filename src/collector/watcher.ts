import chokidar, { type FSWatcher } from 'chokidar';
import type { Adapter } from '../adapters/adapter.js';
import type { Repository } from '../store/repository.js';
import type { PricingTable } from '../pricing/types.js';
import { ingestFile } from './pipeline.js';

export interface WatcherOpts { stabilityThresholdMs?: number; }

export async function startWatcher(adapters: Adapter[], repo: Repository, table: PricingTable, opts: WatcherOpts = {}): Promise<() => Promise<void>> {
  const watchers: FSWatcher[] = [];
  for (const a of adapters) {
    const root = a.rootPath();
    const w = chokidar.watch(root, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: opts.stabilityThresholdMs ?? 100, pollInterval: 30 },
    });
    const handle = async (p: string) => {
      if (!p.endsWith('.jsonl')) return;
      // Sub-agent files are only processed as a rollup under their parent
      // session, never as standalone sessions. Skip them here so we don't
      // double-count their turns into the overview totals.
      if (p.includes('subagents')) return;
      try { await ingestFile(a, p, repo, table); }
      catch (e) { repo.recordParseError({ file: p, byte_offset: -1, reason: e instanceof Error ? e.message : String(e), raw_line_truncated: '' }); }
    };
    w.on('add', handle).on('change', handle);
    watchers.push(w);
  }
  return async () => { await Promise.all(watchers.map(w => w.close())); };
}
