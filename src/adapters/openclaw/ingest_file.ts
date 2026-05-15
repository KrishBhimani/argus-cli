import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { extractOpenClawTurns, type OpenClawRecord } from './extract_turns.js';
import { extractOpenClawToolCalls } from './extract_tool_calls.js';
import { openclawSessionIdFromFilename, namedAgentFromPath } from './discover.js';
import { normalizeCost } from './schemas.js';
import type { AdapterIngestResult, ParseError } from '../adapter.js';
import type { RawTurnEvent } from '../../schema/types.js';

// Same per-tick clamp as the Claude Code adapter — keeps a corrupt or
// runaway file from OOMing the process in one shot.
const MAX_TICK_BYTES = 64 * 1024 * 1024;

// Pricing-table version sentinel for OpenClaw rows. Distinguishes them
// from LiteLLM-version strings in the sessions table so the UI can mark
// "this row's cost was reported by the upstream, not computed by us".
export const OPENCLAW_PRICING_SENTINEL = 'openclaw-reported';

export async function ingestOpenClawFile(
  filePath: string,
  fromOffset = 0,
): Promise<{ result: AdapterIngestResult; new_offset: number }> {
  const fileBasename = basename(filePath);
  const baseId = openclawSessionIdFromFilename(fileBasename);
  if (baseId === null) {
    // Caller (discover) shouldn't hand us such a file, but be defensive.
    return { result: emptyResult(filePath, ''), new_offset: fromOffset };
  }
  const backendAgent = namedAgentFromPath(filePath);

  const fh = await open(filePath, 'r');
  try {
    const stat = await fh.stat();
    const size = stat.size;
    if (size <= fromOffset) {
      return { result: emptyResult(filePath, baseId, backendAgent), new_offset: fromOffset };
    }
    const readLen = Math.min(size - fromOffset, MAX_TICK_BYTES);
    const buf = Buffer.alloc(readLen);
    await fh.read(buf, 0, readLen, fromOffset);
    const text = buf.toString('utf8');

    const lastNewline = text.lastIndexOf('\n');
    const consumable = lastNewline === -1 ? '' : text.slice(0, lastNewline + 1);
    const consumed_bytes = Buffer.byteLength(consumable, 'utf8');
    const new_offset = fromOffset + consumed_bytes;

    const records: OpenClawRecord[] = [];
    const parse_errors: ParseError[] = [];
    let lineByteOffset = fromOffset;

    for (const line of consumable.split('\n')) {
      if (!line) { lineByteOffset += 1; continue; }
      const lineBytes = Buffer.byteLength(line, 'utf8');
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj === 'object' && typeof obj.type === 'string') {
          records.push(obj as OpenClawRecord);
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

    const turns = extractOpenClawTurns(records);
    const tool_calls = extractOpenClawToolCalls(records);

    // Header — derived from the session record if present, otherwise from
    // the first record's timestamp / cwd. Title from the first user text
    // block (skip HEARTBEAT.md per the Python reference).
    const sessionLine = records.find(r => r.type === 'session');
    const firstMsg = records.find(r => r.type === 'message' && r.timestamp);
    const lastMsg = [...records].reverse().find(r => r.type === 'message' && r.timestamp);
    const startedAt = sessionLine?.timestamp ?? firstMsg?.timestamp ?? new Date(0).toISOString();
    const endedAt = lastMsg?.timestamp ?? null;
    const projectPath = sessionLine?.cwd ?? '';
    const title = deriveTitle(records);

    // Sum native costs into agent_reported_cost_usd for audit parity.
    const agentReportedCost = sumNativeCost(turns);

    return {
      result: {
        header: {
          native_session_id: backendAgent ? `${backendAgent}:${baseId}` : baseId,
          agent: 'openclaw',
          agent_version: null,
          project_path: projectPath,
          started_at: startedAt,
          ended_at: endedAt,
          agent_reported_cost_usd: agentReportedCost,
          metadata: title ? { title } : {},
          backend_agent: backendAgent,
          pricing_table_version_override: OPENCLAW_PRICING_SENTINEL,
        },
        turns,
        tool_calls,
        parse_errors,
      },
      new_offset,
    };
  } finally {
    await fh.close();
  }
}

// 80-char trim + HEARTBEAT.md skip, matching the Python reference's title
// derivation behavior. Returns null if nothing usable was found.
function deriveTitle(records: OpenClawRecord[]): string | null {
  for (const rec of records) {
    if (rec.type !== 'message') continue;
    const msg = rec.message;
    if (!msg || msg.role !== 'user') continue;
    const content = msg.content;
    if (!Array.isArray(content)) {
      if (typeof content === 'string') {
        const t = content.trim();
        if (t && !t.startsWith('Read HEARTBEAT.md')) return cap(t, 80);
      }
      continue;
    }
    for (const block of content as Array<{ type?: string; text?: string }>) {
      if (block && block.type === 'text' && typeof block.text === 'string') {
        const t = block.text.trim();
        if (!t || t.startsWith('Read HEARTBEAT.md')) continue;
        return cap(t, 80);
      }
    }
  }
  return null;
}

function cap(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '...' : s;
}

function sumNativeCost(turns: RawTurnEvent[]): number | null {
  let sum = 0;
  let any = false;
  for (const t of turns) {
    if (typeof t.cost_usd_override === 'number') {
      sum += t.cost_usd_override;
      any = true;
    }
  }
  return any ? sum : null;
}

// Used when the file was already fully consumed in a prior tick (or the
// filename was rejected). All array fields are empty; the header carries
// enough identity for the pipeline's "no turns ⇒ skip" guard to apply.
function emptyResult(filePath: string, baseId: string, backendAgent: string | null = null): AdapterIngestResult {
  // Suppress the unused-vars TS check — filePath is in the signature for
  // future use (e.g. logging) and keeps the call sites symmetric with the
  // Claude Code adapter.
  void filePath;
  return {
    header: {
      native_session_id: backendAgent ? `${backendAgent}:${baseId}` : baseId,
      agent: 'openclaw',
      agent_version: null,
      project_path: '',
      started_at: '',
      ended_at: null,
      agent_reported_cost_usd: null,
      metadata: {},
      backend_agent: backendAgent,
      pricing_table_version_override: OPENCLAW_PRICING_SENTINEL,
    },
    turns: [],
    tool_calls: [],
    parse_errors: [],
  };
}

// Re-export the cost normalizer for any code that wants to introspect a
// raw `usage.cost` shape without re-parsing the JSONL.
export { normalizeCost };
