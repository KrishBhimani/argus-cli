import type { RawToolCall } from '../../schema/types.js';
import type { OpenClawRecord } from './extract_turns.js';

// Walk one OpenClaw session file's records in order. Emit one RawToolCall
// per `toolCall` block found inside an assistant message's content array.
// Error attribution: OpenClaw's `toolResult` records carry an `isError`
// flag plus a `toolCallId` linking back to the call. We build a side-map
// of (toolCallId → isError) by walking the records once, then stamp it on
// each emitted call.
export function extractOpenClawToolCalls(records: OpenClawRecord[]): RawToolCall[] {
  // First pass: gather toolCallId → isError from toolResult records.
  const errorByCallId = new Map<string, boolean>();
  for (const rec of records) {
    if (rec.type !== 'message') continue;
    const msg = rec.message;
    if (!msg || msg.role !== 'toolResult') continue;
    if (typeof msg.toolCallId !== 'string') continue;
    errorByCallId.set(msg.toolCallId, Boolean(msg.isError));
  }

  // Second pass: emit one RawToolCall per toolCall block.
  const out: RawToolCall[] = [];
  let turnIndex = -1;
  for (const rec of records) {
    if (rec.type !== 'message') continue;
    const msg = rec.message;
    if (!msg || msg.role !== 'assistant') continue;
    if (!msg.usage) continue;
    turnIndex++;
    if (!Array.isArray(msg.content)) continue;
    for (let i = 0; i < msg.content.length; i++) {
      const block = msg.content[i] as { type?: string; id?: string; name?: string; arguments?: unknown };
      if (!block || block.type !== 'toolCall' || typeof block.id !== 'string' || typeof block.name !== 'string') continue;
      const args = block.arguments;
      const inputSize = args === undefined ? 0 : JSON.stringify(args).length;
      out.push({
        native_turn_id: msg.id ?? rec.id ?? `turn-${turnIndex}`,
        turn_index: turnIndex,
        block_index: i,
        tool_name: block.name,
        tool_use_id: block.id,
        is_error: errorByCallId.get(block.id) ? 1 : 0,
        input_size: inputSize,
        subagent_type: null,  // OpenClaw has no Task-tool sub-agent dispatch
        timestamp: rec.timestamp ?? '',
      });
    }
  }
  return out;
}
