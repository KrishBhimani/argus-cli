import type { RawTurnEvent } from '../../schema/types.js';
import type { AssistantLine } from './schemas.js';
import { canonicalizeClaudeModel } from './model.js';

export function extractTurns(lines: AssistantLine[]): RawTurnEvent[] {
  const byMessageId = new Map<string, AssistantLine[]>();
  const order: string[] = [];
  for (const line of lines) {
    const id = line.message.id;
    if (!byMessageId.has(id)) {
      byMessageId.set(id, []);
      order.push(id);
    }
    byMessageId.get(id)!.push(line);
  }

  const turns: RawTurnEvent[] = [];
  let seq = 0;
  for (const id of order) {
    const group = byMessageId.get(id)!;
    const first = group[0];
    const usage = first.message.usage;
    const cache_5m = usage.cache_creation?.ephemeral_5m_input_tokens ?? null;
    const cache_1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? null;
    const toolCalls = group.reduce((acc, l) => acc + l.message.content.filter(b => b.type === 'tool_use').length, 0);

    turns.push({
      native_turn_id: id,
      sequence: seq++,
      timestamp: first.timestamp,
      model: canonicalizeClaudeModel(first.message.model),
      model_raw: first.message.model,
      fresh_input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_input_tokens,
      cache_write_tokens: usage.cache_creation_input_tokens,
      cache_write_5m_tokens: cache_5m,
      cache_write_1h_tokens: cache_1h,
      tool_calls_count: toolCalls,
      metadata: {
        service_tier: usage.service_tier,
        agentId: first.agentId,
        attribution_agent: (first as any).attribution_agent,
        isSidechain: first.isSidechain ?? false,
      },
    });
  }
  return turns;
}
