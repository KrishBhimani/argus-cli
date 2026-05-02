import { open } from 'node:fs/promises';
import { z } from 'zod';
import type { Repository } from '../../store/repository.js';
import { normalizeProjectPath } from '../../store/repository.js';
import type { Prompt } from '../../schema/types.js';

// Hard cap on the indexed body. Eight kilobytes is way past any realistic
// hand-typed prompt; anything longer is almost always a paste-by-mistake
// where the user pasted a file into the prompt without using the paste
// shortcut. We truncate so FTS5 doesn't try to index a multi-megabyte row.
const DISPLAY_CAP_BYTES = 8 * 1024;

// One line of ~/.claude/history.jsonl. The file is global (not per-session)
// and Claude Code appends to it on every prompt submission.
const HistoryLineSchema = z.object({
  display: z.string(),
  pastedContents: z.record(z.unknown()).optional().default({}),
  timestamp: z.number(),
  project: z.string(),
});

export interface HistoryIngestStats {
  inserted: number;
  skipped_empty: number;
  parse_errors: number;
  new_offset: number;
}

// Read ~/.claude/history.jsonl from the stored byte offset, parse new lines,
// and write them to the prompts table. Mirrors the byte-offset tail pattern
// used for session JSONL — partial last line is held back until the next
// tick. If the file has shrunk below the recorded offset (rotation /
// truncation), we reset to 0 and re-ingest from scratch.
//
// The repository is the only consumer of these rows: we don't return the
// inserted rows themselves, just stats that callers can log.
export async function ingestHistoryFile(
  filePath: string,
  repo: Repository,
): Promise<HistoryIngestStats> {
  const offsetKey = `history:${filePath}`;
  let fromOffset = repo.getFileOffset(offsetKey);

  const fh = await open(filePath, 'r');
  try {
    const stat = await fh.stat();
    const size = stat.size;

    // Rotation / truncation: file is smaller than the offset we last
    // recorded. Treat as fresh — re-ingest from the start. The prompts
    // table has no uniqueness constraint, so this can produce duplicates;
    // worth fixing only if it ever happens in practice.
    if (size < fromOffset) fromOffset = 0;

    if (size <= fromOffset) {
      return { inserted: 0, skipped_empty: 0, parse_errors: 0, new_offset: fromOffset };
    }

    const buf = Buffer.alloc(size - fromOffset);
    await fh.read(buf, 0, buf.length, fromOffset);
    const text = buf.toString('utf8');

    const lastNewline = text.lastIndexOf('\n');
    const consumable = lastNewline === -1 ? '' : text.slice(0, lastNewline + 1);
    const consumed_bytes = Buffer.byteLength(consumable, 'utf8');
    const new_offset = fromOffset + consumed_bytes;

    const rows: Omit<Prompt, 'id'>[] = [];
    let parse_errors = 0;
    let skipped_empty = 0;

    for (const line of consumable.split('\n')) {
      if (!line) continue;
      let obj: unknown;
      try {
        obj = JSON.parse(line);
      } catch {
        parse_errors++;
        continue;
      }
      const parsed = HistoryLineSchema.safeParse(obj);
      if (!parsed.success) {
        parse_errors++;
        continue;
      }
      const row = lineToPrompt(parsed.data);
      if (row === null) {
        skipped_empty++;
        continue;
      }
      rows.push(row);
    }

    repo.insertPrompts(rows);
    repo.setFileOffset(offsetKey, new_offset);

    return { inserted: rows.length, skipped_empty, parse_errors, new_offset };
  } finally {
    await fh.close();
  }
}

// Pure transformation: history.jsonl line → prompts row, or null if the
// line should be skipped (empty/whitespace-only display). Exposed for unit
// testing without touching the filesystem.
export function lineToPrompt(line: z.infer<typeof HistoryLineSchema>): Omit<Prompt, 'id'> | null {
  const trimmed = line.display.trim();
  if (trimmed === '') return null;

  // Cap by bytes, not chars, so unicode-heavy prompts don't blow past the
  // cap due to multi-byte characters. Truncation is suffix-marked so a
  // future reader can tell something was elided.
  let display = line.display;
  if (Buffer.byteLength(display, 'utf8') > DISPLAY_CAP_BYTES) {
    // Walk back from the cap to a safe utf-8 boundary by repeatedly
    // re-encoding the slice until it fits. Cheap because the cap is
    // small.
    let cap = DISPLAY_CAP_BYTES;
    while (cap > 0 && Buffer.byteLength(display.slice(0, cap), 'utf8') > DISPLAY_CAP_BYTES - 1) {
      cap--;
    }
    display = display.slice(0, cap) + '…';
  }

  // pasted_chars is a cheap upper bound on paste size — JSON-stringified
  // length of the whole pastedContents object. We never index the body.
  let pasted_chars = 0;
  try {
    pasted_chars = JSON.stringify(line.pastedContents ?? {}).length;
    if (pasted_chars <= 2) pasted_chars = 0; // "{}" → no paste
  } catch {
    pasted_chars = 0;
  }

  return {
    timestamp_ms: line.timestamp,
    project_path: normalizeProjectPath(line.project),
    display,
    pasted_chars,
    is_slash: trimmed.startsWith('/') ? 1 : 0,
  };
}
