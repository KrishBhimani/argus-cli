import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Adapter } from '../adapters/adapter.js';
import type { Repository } from '../store/repository.js';
import type { PricingTable } from '../pricing/types.js';
import { ingestFile } from './pipeline.js';
import { ingestHistoryFile } from '../adapters/claude_code/history_jsonl.js';
import { ClaudeCodeAdapter } from '../adapters/claude_code/index.js';

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
      try { await ingestFile(adapter, file, repo, table); }
      catch (e) {
        repo.recordParseError({ file, byte_offset: -1, reason: `[ingest] ${e instanceof Error ? e.message : String(e)}`, raw_line_truncated: '' });
      }
      processed++;
    }

    // Slice 1: ingest ~/.claude/history.jsonl for the Prompts page during
    // the foreground phase. It's a small single file (~1500 lines for a
    // heavy user) so reading it eagerly doesn't push the foreground time
    // past acceptable. Done after recent sessions so the prompts have
    // session candidates to link against.
    for (const a of adapters) {
      if (a.agent === 'claude_code') {
        const historyPath = join(a.rootPath(), 'history.jsonl');
        if (existsSync(historyPath)) {
          try { await ingestHistoryFile(historyPath, repo); }
          catch (e) {
            repo.recordParseError({
              file: historyPath, byte_offset: -1,
              reason: `[history] ${e instanceof Error ? e.message : String(e)}`,
              raw_line_truncated: '',
            });
          }
        }
      }
    }

    foregroundComplete = true;
    return { older };
  })();

  const backfillDone = (async () => {
    const { older } = await foregroundDone;
    for (const { adapter, file } of older) {
      try { await ingestFile(adapter, file, repo, table); }
      catch (e) {
        repo.recordParseError({ file, byte_offset: -1, reason: `[ingest] ${e instanceof Error ? e.message : String(e)}`, raw_line_truncated: '' });
      }
      processed++;
    }

    // Slice 1: backfill tool_calls for sessions ingested before this slice
    // shipped (or before tool_calls was added to a given session's data).
    // We re-ingest those files from offset 0 — the upsert pattern means
    // turns and offsets stay consistent, but tool_calls populate where
    // they were missing. Cap at 200 sessions per startup so a huge
    // backlog doesn't dominate the background phase.
    await backfillToolCalls(adapters, repo, table);
  })();

  return { foregroundDone, backfillDone, status: (): IngestStatus => ({ foregroundComplete, pending: total - processed, processed, total }) };
}

// Re-ingest sessions that don't yet have any tool_calls rows. We reset
// their byte offset to 0 and let the normal pipeline re-walk; existing
// turns upsert in place (no double-count) and tool_calls populate as a
// side effect. Top-level sessions only — sub-agent files are walked as
// part of their parent's re-ingest.
async function backfillToolCalls(adapters: Adapter[], repo: Repository, table: PricingTable): Promise<void> {
  const candidates = repo.sessionsMissingToolCalls(200);
  if (candidates.length === 0) return;

  // Map session id → likely file path. We can derive it from
  // discoverSessionFiles for each adapter and match by basename, since the
  // session id is `${agent}:${basename(file, '.jsonl')}`.
  const fileByBasename = new Map<string, { adapter: Adapter; file: string }>();
  for (const a of adapters) {
    if (a.agent !== 'claude_code') continue;
    // Reuse discoverSessionFiles. ClaudeCodeAdapter only returns top-level
    // session files, which is what we want here.
    if (!(a instanceof ClaudeCodeAdapter)) continue;
    for (const f of await a.discoverSessionFiles()) {
      const base = f.split(/[\\/]/).pop()?.replace(/\.jsonl$/, '');
      if (base) fileByBasename.set(base, { adapter: a, file: f });
    }
  }

  for (const { id } of candidates) {
    // Session ids are formatted "claude_code:<basename>" for top-level
    // sessions. Ignore anything with a slash (sub-agent rollup) — those
    // get backfilled when their parent re-ingests.
    if (id.includes('/')) continue;
    const colon = id.indexOf(':');
    if (colon < 0) continue;
    const native = id.slice(colon + 1);
    const match = fileByBasename.get(native);
    if (!match) continue;
    // Reset offset so we re-walk the whole file, then ingest.
    repo.setFileOffset(match.file, 0);
    try { await ingestFile(match.adapter, match.file, repo, table); }
    catch (e) {
      repo.recordParseError({
        file: match.file, byte_offset: -1,
        reason: `[backfill-tools] ${e instanceof Error ? e.message : String(e)}`,
        raw_line_truncated: '',
      });
    }
  }
}
