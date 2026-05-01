import { stat } from 'node:fs/promises';
import type { Adapter } from '../adapters/adapter.js';
import type { Repository } from '../store/repository.js';
import type { PricingTable } from '../pricing/types.js';
import { ingestFile } from './pipeline.js';

export interface FirstRunOpts { recentDays: number; }

export interface IngestStatus { foregroundComplete: boolean; pending: number; processed: number; total: number; }

export function runFirstPassIngest(adapters: Adapter[], repo: Repository, table: PricingTable, opts: FirstRunOpts) {
  const cutoff = Date.now() - opts.recentDays * 86_400_000;
  let processed = 0, total = 0;
  let foregroundComplete = false;

  const foregroundDone = (async () => {
    const recent: { adapter: Adapter; file: string }[] = [];
    const older: { adapter: Adapter; file: string }[] = [];
    for (const a of adapters) {
      for (const f of await a.discoverSessionFiles()) {
        try {
          const st = await stat(f);
          if (st.mtimeMs >= cutoff) recent.push({ adapter: a, file: f });
          else older.push({ adapter: a, file: f });
        } catch { /* skip */ }
      }
    }
    total = recent.length + older.length;
    for (const { adapter, file } of recent) {
      await ingestFile(adapter, file, repo, table);
      processed++;
    }
    foregroundComplete = true;
    return { older };
  })();

  const backfillDone = (async () => {
    const { older } = await foregroundDone;
    for (const { adapter, file } of older) {
      await ingestFile(adapter, file, repo, table);
      processed++;
    }
  })();

  return { foregroundDone, backfillDone, status: (): IngestStatus => ({ foregroundComplete, pending: total - processed, processed, total }) };
}
