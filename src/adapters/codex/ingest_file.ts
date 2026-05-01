import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { EnvelopeLineSchema, LegacyLineSchema, isEnvelope, type EnvelopeLine } from './schemas.js';
import type { AdapterIngestResult, ParseError } from '../adapter.js';
import { extractCodexTurns } from './extract_turns.js';

export async function ingestCodexFile(filePath: string, fromOffset = 0): Promise<{ result: AdapterIngestResult; new_offset: number }> {
  const fh = await open(filePath, 'r');
  try {
    const stat = await fh.stat();
    const size = stat.size;
    if (size <= fromOffset) return { result: empty(filePath), new_offset: fromOffset };
    const buf = Buffer.alloc(size - fromOffset);
    await fh.read(buf, 0, buf.length, fromOffset);
    const text = buf.toString('utf8');
    const lastNewline = text.lastIndexOf('\n');
    const consumable = lastNewline === -1 ? '' : text.slice(0, lastNewline + 1);
    const new_offset = fromOffset + Buffer.byteLength(consumable, 'utf8');

    const envelopeLines: EnvelopeLine[] = [];
    const parse_errors: ParseError[] = [];
    let lineByteOffset = fromOffset;

    for (const line of consumable.split('\n')) {
      if (!line) { lineByteOffset += 1; continue; }
      const lineBytes = Buffer.byteLength(line, 'utf8');
      try {
        const obj = JSON.parse(line);
        if (isEnvelope(obj)) {
          envelopeLines.push(EnvelopeLineSchema.parse(obj));
        } else {
          LegacyLineSchema.parse(obj);
        }
      } catch (e) {
        parse_errors.push({
          file: filePath,
          byte_offset: lineByteOffset,
          reason: e instanceof Error ? e.message : String(e),
          raw_line_truncated: line.slice(0, 200),
        });
      }
      lineByteOffset += lineBytes + 1;
    }

    if (envelopeLines.length === 0) {
      return {
        result: {
          header: {
            native_session_id: basename(filePath, '.jsonl'),
            agent: 'codex',
            agent_version: null,
            project_path: '',
            started_at: '',
            ended_at: null,
            agent_reported_cost_usd: null,
            metadata: { schema: 'legacy_or_empty' },
          },
          turns: [],
          parse_errors,
        },
        new_offset,
      };
    }

    const { header, turns } = extractCodexTurns(envelopeLines);
    return { result: { header, turns, parse_errors }, new_offset };
  } finally {
    await fh.close();
  }
}

function empty(file: string): AdapterIngestResult {
  return {
    header: { native_session_id: basename(file, '.jsonl'), agent: 'codex', agent_version: null, project_path: '', started_at: '', ended_at: null, agent_reported_cost_usd: null, metadata: {} },
    turns: [],
    parse_errors: [],
  };
}
