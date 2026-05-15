import { describe, it, expect } from 'vitest';
import { extractOpenClawToolCalls } from './extract_tool_calls.js';
import type { OpenClawRecord } from './extract_turns.js';

describe('extractOpenClawToolCalls', () => {
  it('emits one RawToolCall per toolCall block in assistant messages', () => {
    const records: OpenClawRecord[] = [
      { type: 'session', id: 's', timestamp: '2026-05-08T00:00:00Z', cwd: '/p' },
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1',
          content: [
            { type: 'thinking' } as any,
            { type: 'toolCall', id: 'tc-1', name: 'read', arguments: { path: 'foo' } } as any,
            { type: 'toolCall', id: 'tc-2', name: 'write' } as any,
          ],
          usage: { input: 1, output: 1, cost: 0 },
        } },
    ];
    const calls = extractOpenClawToolCalls(records);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      native_turn_id: 'asst-1', turn_index: 0, block_index: 1,
      tool_name: 'read', tool_use_id: 'tc-1', is_error: 0,
    });
    expect(calls[1]).toMatchObject({
      native_turn_id: 'asst-1', turn_index: 0, block_index: 2,
      tool_name: 'write', tool_use_id: 'tc-2', is_error: 0,
    });
  });

  it('marks is_error=1 when a later toolResult has isError=true and matching toolCallId', () => {
    const records: OpenClawRecord[] = [
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1',
          content: [{ type: 'toolCall', id: 'tc-1', name: 'read' } as any],
          usage: { input: 1, output: 1, cost: 0 } } },
      { type: 'message', id: 'tr1', timestamp: '2026-05-08T00:00:03Z',
        message: { role: 'toolResult', toolCallId: 'tc-1', toolName: 'read', isError: true,
          content: [{ type: 'text', text: 'ENOENT' } as any] } },
    ];
    const calls = extractOpenClawToolCalls(records);
    expect(calls).toHaveLength(1);
    expect(calls[0].is_error).toBe(1);
  });

  it('leaves is_error=0 when toolResult has isError=false', () => {
    const records: OpenClawRecord[] = [
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1',
          content: [{ type: 'toolCall', id: 'tc-1', name: 'read' } as any],
          usage: { input: 1, output: 1, cost: 0 } } },
      { type: 'message', id: 'tr1', timestamp: '2026-05-08T00:00:03Z',
        message: { role: 'toolResult', toolCallId: 'tc-1', toolName: 'read', isError: false,
          content: [{ type: 'text', text: 'ok' } as any] } },
    ];
    const calls = extractOpenClawToolCalls(records);
    expect(calls[0].is_error).toBe(0);
  });

  it('records input_size as JSON.stringify(arguments).length', () => {
    const args = { path: 'foo/bar' };
    const records: OpenClawRecord[] = [
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1',
          content: [{ type: 'toolCall', id: 'tc-1', name: 'read', arguments: args } as any],
          usage: { input: 1, output: 1, cost: 0 } } },
    ];
    const calls = extractOpenClawToolCalls(records);
    expect(calls[0].input_size).toBe(JSON.stringify(args).length);
  });

  it('subagent_type is null (OpenClaw has no Task delegation primitive)', () => {
    const records: OpenClawRecord[] = [
      { type: 'message', id: 'a1', timestamp: '2026-05-08T00:00:02Z',
        message: { role: 'assistant', id: 'asst-1',
          content: [{ type: 'toolCall', id: 'tc-1', name: 'read' } as any],
          usage: { input: 1, output: 1, cost: 0 } } },
    ];
    const calls = extractOpenClawToolCalls(records);
    expect(calls[0].subagent_type).toBeNull();
  });
});
