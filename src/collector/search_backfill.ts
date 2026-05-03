import type { Adapter } from '../adapters/adapter.js';
import type { Repository } from '../store/repository.js';
import type { PricingTable } from '../pricing/types.js';
import { ingestFile } from './pipeline.js';
import { ClaudeCodeAdapter } from '../adapters/claude_code/index.js';

export interface SearchBackfillStatus {
  in_progress: boolean;
  processed: number;
  total: number;
  started_at_ms: number | null;
  finished_at_ms: number | null;
}

// Singleton process state. Used by the API/CLI to report progress and to
// reject overlapping enable-clicks ("a backfill is already running").
const state: SearchBackfillStatus = {
  in_progress: false,
  processed: 0,
  total: 0,
  started_at_ms: null,
  finished_at_ms: null,
};

export function getSearchBackfillStatus(): SearchBackfillStatus {
  return { ...state };
}

// Re-ingest sessions that don't yet have any transcript_segments rows.
// This is a thin wrapper around the existing pipeline — re-ingesting
// from offset 0 — but limited to top-level claude_code sessions and
// gated by the in-progress flag so we don't run two at once. Caller is
// responsible for setting enable_transcript_search BEFORE invoking
// this; otherwise the pipeline will skip segment writes and the work
// is wasted.
//
// Caps total at 1000 sessions per run to keep memory bounded; if a
// user has more than that, a second start (or a second `argus search
// enable`) will pick up where this one left off.
export async function runSegmentBackfill(
  adapters: Adapter[],
  repo: Repository,
  table: PricingTable,
): Promise<SearchBackfillStatus> {
  if (state.in_progress) return getSearchBackfillStatus();

  // Discover top-level files for each claude_code adapter once, build a
  // basename → file map, then walk the candidate list against it.
  const fileByBasename = new Map<string, { adapter: Adapter; file: string }>();
  for (const a of adapters) {
    if (!(a instanceof ClaudeCodeAdapter)) continue;
    for (const f of await a.discoverSessionFiles()) {
      const base = f.split(/[\\/]/).pop()?.replace(/\.jsonl$/, '');
      if (base) fileByBasename.set(base, { adapter: a, file: f });
    }
  }

  const candidates = repo.sessionsMissingSegments(1000)
    .filter(c => !c.id.includes('/')); // sub-agents are walked via parents

  state.in_progress = true;
  state.processed = 0;
  state.total = candidates.length;
  state.started_at_ms = Date.now();
  state.finished_at_ms = null;

  // Kick the heavy work into the next microtask so the API call that
  // started us returns immediately. The ingestFile loop itself awaits
  // each file, so we don't drown the disk in parallel reads.
  (async () => {
    try {
      for (const { id } of candidates) {
        const colon = id.indexOf(':');
        if (colon < 0) { state.processed++; continue; }
        const native = id.slice(colon + 1);
        const match = fileByBasename.get(native);
        if (!match) { state.processed++; continue; }
        // Reset the file offset so we re-walk the whole file. Existing
        // turns / tool_calls upsert in place — segments populate where
        // they were missing.
        repo.setFileOffset(match.file, 0);
        try { await ingestFile(match.adapter, match.file, repo, table); }
        catch (e) {
          repo.recordParseError({
            file: match.file, byte_offset: -1,
            reason: `[search-backfill] ${e instanceof Error ? e.message : String(e)}`,
            raw_line_truncated: '',
          });
        }
        state.processed++;
      }
    } finally {
      state.in_progress = false;
      state.finished_at_ms = Date.now();
    }
  })();

  return getSearchBackfillStatus();
}
