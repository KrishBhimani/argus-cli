import type { AssistantLine, UserLine } from './schemas.js';
import type { RawToolCall } from '../../schema/types.js';

// Re-export so existing imports from this module keep working. New code
// should import RawToolCall directly from schema/types.js.
export type { RawToolCall };

// Walks a session's assistant + user lines and emits one RawToolCall per
// tool_use block found in any assistant message.
//
// Error attribution: tool_result blocks live in user messages (the next
// user turn after the assistant's tool_use). Each result references a
// tool_use_id, so we build a side-map up front and look up is_error per
// emitted call. Aborted sessions can have tool_uses with no matching
// result — those get is_error = 0 by design.
//
// Dedup logic mirrors extractTurns: a single message can be split across
// multiple JSONL lines (one per content block in some Claude Code
// versions), all sharing message.id. We group by id, preserve original
// ordering, and walk every line's content[] so no tool_use is dropped.
export function extractToolCalls(
  assistantLines: AssistantLine[],
  userLines: UserLine[],
): RawToolCall[] {
  // 1) Build tool_use_id → is_error from tool_result blocks in user messages.
  //    We use unknown / any for the inner blocks because UserLineSchema
  //    keeps content as a passthrough union, not a typed discriminated set.
  const errorMap = new Map<string, boolean>();
  for (const u of userLines) {
    const content = u.message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content as any[]) {
      if (block && block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        // is_error is sometimes missing; treat as false. Also accept the
        // string "true" defensively (some legacy lines stringified booleans).
        const flag = block.is_error === true || block.is_error === 'true';
        errorMap.set(block.tool_use_id, flag);
      }
    }
  }

  // 2) Group assistant lines by message.id, preserve first-seen order.
  const byId = new Map<string, AssistantLine[]>();
  const order: string[] = [];
  for (const line of assistantLines) {
    const id = line.message.id;
    if (!byId.has(id)) {
      byId.set(id, []);
      order.push(id);
    }
    byId.get(id)!.push(line);
  }

  // 3) Emit one RawToolCall per tool_use block.
  const out: RawToolCall[] = [];
  let turnIndex = 0;
  for (const id of order) {
    const group = byId.get(id)!;
    let blockIndex = 0;
    for (const line of group) {
      for (const block of line.message.content) {
        if (block.type !== 'tool_use') continue;
        const input = (block as any).input ?? {};
        const name = (block as any).name as string;
        const useId = (block as any).id as string;
        out.push({
          native_turn_id: id,
          turn_index: turnIndex,
          block_index: blockIndex,
          tool_name: name,
          tool_use_id: useId,
          is_error: errorMap.get(useId) ? 1 : 0,
          input_size: safeStringifyLength(input),
          subagent_type:
            name === 'Task' && typeof input?.subagent_type === 'string'
              ? input.subagent_type
              : null,
          timestamp: line.timestamp,
        });
        blockIndex++;
      }
    }
    turnIndex++;
  }
  return out;
}

function safeStringifyLength(v: unknown): number {
  try {
    return JSON.stringify(v).length;
  } catch {
    return 0;
  }
}
