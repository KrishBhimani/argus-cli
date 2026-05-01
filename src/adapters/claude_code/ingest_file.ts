import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { AssistantLineSchema, type AssistantLine } from './schemas.js';
import type { AdapterIngestResult, ParseError } from '../adapter.js';
import { extractTurns } from './extract_turns.js';

export async function ingestClaudeCodeFile(
  filePath: string,
  fromOffset = 0
): Promise<{ result: AdapterIngestResult; new_offset: number }> {
  const fh = await open(filePath, 'r');
  try {
    const stat = await fh.stat();
    const size = stat.size;
    if (size <= fromOffset) {
      return { result: emptyResult(filePath), new_offset: fromOffset };
    }
    const buf = Buffer.alloc(size - fromOffset);
    await fh.read(buf, 0, buf.length, fromOffset);
    const text = buf.toString('utf8');

    const lastNewline = text.lastIndexOf('\n');
    const consumable = lastNewline === -1 ? '' : text.slice(0, lastNewline + 1);
    const consumed_bytes = Buffer.byteLength(consumable, 'utf8');
    const new_offset = fromOffset + consumed_bytes;

    const assistantLines: AssistantLine[] = [];
    const parse_errors: ParseError[] = [];
    let lineByteOffset = fromOffset;

    for (const line of consumable.split('\n')) {
      if (!line) { lineByteOffset += 1; continue; }
      const lineBytes = Buffer.byteLength(line, 'utf8');
      try {
        const obj = JSON.parse(line);
        if (obj?.type === 'assistant') {
          const parsed = AssistantLineSchema.parse(obj);
          assistantLines.push(parsed);
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

    const turns = extractTurns(assistantLines);
    const sessionId = basename(filePath, '.jsonl');
    const cwd = assistantLines[0]?.cwd ?? '';
    const version = assistantLines[assistantLines.length - 1]?.version ?? null;
    const startedAt = assistantLines[0]?.timestamp ?? new Date(0).toISOString();
    const endedAt = assistantLines[assistantLines.length - 1]?.timestamp ?? null;

    return {
      result: {
        header: {
          native_session_id: sessionId,
          agent: 'claude_code',
          agent_version: version,
          project_path: cwd,
          started_at: startedAt,
          ended_at: endedAt,
          agent_reported_cost_usd: null,
          metadata: {},
        },
        turns,
        parse_errors,
      },
      new_offset,
    };
  } finally {
    await fh.close();
  }
}

function emptyResult(file: string): AdapterIngestResult {
  return {
    header: { native_session_id: basename(file, '.jsonl'), agent: 'claude_code', agent_version: null, project_path: '', started_at: '', ended_at: null, agent_reported_cost_usd: null, metadata: {} },
    turns: [],
    parse_errors: [],
  };
}
