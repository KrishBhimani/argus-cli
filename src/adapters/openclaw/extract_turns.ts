import type { RawTurnEvent } from '../../schema/types.js';
import { normalizeCost } from './schemas.js';

// Adapter-local record type — parsed JSONL line. Loose so callers can pass
// pre-parsed objects in tests without round-tripping through zod.
export interface OpenClawRecord {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  // session header
  cwd?: string;
  version?: number;
  // model_change
  provider?: string;
  modelId?: string;
  // message
  message?: {
    role?: string;
    content?: unknown;
    id?: string;
    model?: string;
    provider?: string;
    usage?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      cost?: unknown;
    };
    toolCallId?: string;
    toolName?: string;
    isError?: boolean;
  };
}

// Walk one OpenClaw session file's records in order. Emit one
// RawTurnEvent per assistant message that carries a `usage` block. Buffer
// the active provider/model from model_change events so assistant
// messages that don't repeat them inherit the right values.
export function extractOpenClawTurns(records: OpenClawRecord[]): RawTurnEvent[] {
  const out: RawTurnEvent[] = [];
  let activeProvider: string | null = null;
  let activeModel: string | null = null;
  let sequence = 0;

  for (const rec of records) {
    if (rec.type === 'model_change') {
      if (rec.provider) activeProvider = rec.provider;
      if (rec.modelId) activeModel = rec.modelId;
      continue;
    }
    if (rec.type !== 'message') continue;
    const msg = rec.message;
    if (!msg || msg.role !== 'assistant') continue;
    if (!msg.usage) continue;

    const provider = msg.provider ?? activeProvider ?? null;
    const model = msg.model ?? activeModel ?? 'unknown';
    const u = msg.usage;
    const cost = normalizeCost(u.cost);

    // Count toolCall blocks in the assistant content array.
    let toolCalls = 0;
    if (Array.isArray(msg.content)) {
      for (const block of msg.content as Array<{ type?: string }>) {
        if (block && typeof block === 'object' && block.type === 'toolCall') toolCalls++;
      }
    }

    const turnId = msg.id ?? rec.id ?? `turn-${sequence}`;
    out.push({
      native_turn_id: turnId,
      sequence,
      timestamp: rec.timestamp ?? '',
      model,
      model_raw: model,
      fresh_input_tokens: u.input ?? 0,
      output_tokens: u.output ?? 0,
      cache_read_tokens: u.cacheRead ?? 0,
      cache_write_tokens: u.cacheWrite ?? 0,
      cache_write_5m_tokens: null,
      cache_write_1h_tokens: null,
      tool_calls_count: toolCalls,
      metadata: {},
      cost_usd_override: cost,
      provider,
    });
    sequence++;
  }
  return out;
}
