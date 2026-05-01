import type { RawTurnEvent, RawSessionHeader } from '../../schema/types.js';
import type { EnvelopeLine } from './schemas.js';

interface CumulativeSnapshot {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
}

const ZERO: CumulativeSnapshot = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 };

export function extractCodexTurns(lines: EnvelopeLine[]): { header: RawSessionHeader; turns: RawTurnEvent[] } {
  let sessionId = 'unknown';
  let cwd = '';
  let cliVersion: string | null = null;
  let startedAt = '';
  let endedAt: string | null = null;
  const turns: RawTurnEvent[] = [];

  let prev = ZERO;
  let currentModel = 'unknown';
  let currentEffort: string | undefined;
  let currentTurnStart: string | null = null;
  let currentToolCalls = 0;
  let seq = 0;

  for (const line of lines) {
    endedAt = line.timestamp;
    if (line.type === 'session_meta') {
      sessionId = line.payload.id;
      cwd = line.payload.cwd;
      startedAt = line.payload.timestamp;
      cliVersion = line.payload.cli_version ?? null;
      continue;
    }
    if (line.type === 'turn_context') {
      currentModel = line.payload.model;
      currentEffort = line.payload.effort;
      if (line.payload.cwd) cwd = line.payload.cwd;
      currentTurnStart = line.timestamp;
      currentToolCalls = 0;
      continue;
    }
    if (line.type === 'response_item' && (line.payload as any).type === 'function_call') {
      currentToolCalls += 1;
      continue;
    }
    if (line.type === 'event_msg' && (line.payload as any).type === 'token_count') {
      const info = (line.payload as any).info;
      const cur: CumulativeSnapshot = {
        input_tokens: info.total_token_usage.input_tokens,
        cached_input_tokens: info.total_token_usage.cached_input_tokens ?? 0,
        output_tokens: info.total_token_usage.output_tokens,
        reasoning_output_tokens: info.total_token_usage.reasoning_output_tokens ?? 0,
      };
      const deltaCachedRead = cur.cached_input_tokens - prev.cached_input_tokens;
      const totalInputDelta = cur.input_tokens - prev.input_tokens;
      const fresh = totalInputDelta - deltaCachedRead;
      const outputDelta = cur.output_tokens - prev.output_tokens;
      const reasoningDelta = cur.reasoning_output_tokens - prev.reasoning_output_tokens;

      turns.push({
        native_turn_id: `${sessionId}:turn:${seq}`,
        sequence: seq++,
        timestamp: currentTurnStart ?? line.timestamp,
        model: currentModel,
        model_raw: currentModel,
        fresh_input_tokens: Math.max(0, fresh),
        output_tokens: outputDelta + reasoningDelta,
        cache_read_tokens: Math.max(0, deltaCachedRead),
        cache_write_tokens: 0,
        cache_write_5m_tokens: null,
        cache_write_1h_tokens: null,
        tool_calls_count: currentToolCalls,
        metadata: {
          reasoning_output_tokens: reasoningDelta,
          effort: currentEffort,
          model_context_window: info.model_context_window,
        },
      });
      prev = cur;
    }
  }

  return {
    header: {
      native_session_id: sessionId,
      agent: 'codex',
      agent_version: cliVersion,
      project_path: cwd,
      started_at: startedAt,
      ended_at: endedAt,
      agent_reported_cost_usd: null,
      metadata: {},
    },
    turns,
  };
}
