import { describe, it, expect } from 'vitest';
import { extractToolCalls } from './extract_tool_calls.js';
import type { AssistantLine, UserLine } from './schemas.js';

const mkAssistant = (msgId: string, seq: number, content: any[]): AssistantLine => ({
  type: 'assistant',
  sessionId: 's1', uuid: `u${seq}`, timestamp: `2026-05-01T00:00:0${seq}Z`, cwd: '/p',
  message: {
    id: msgId, model: 'claude-opus-4-7', role: 'assistant',
    content,
    usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  } as any,
});

const mkUserToolResult = (toolUseId: string, isError: boolean, seq: number): UserLine => ({
  type: 'user',
  sessionId: 's1', uuid: `u${seq}`, timestamp: `2026-05-01T00:00:1${seq}Z`, cwd: '/p',
  message: {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: toolUseId, is_error: isError, content: 'x' } as any],
  } as any,
});

describe('extractToolCalls', () => {
  it('emits one row per tool_use block', () => {
    const lines = [mkAssistant('m1', 0, [
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } },
      { type: 'text', text: 'between' },
      { type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: '/x', old_string: 'a', new_string: 'b' } },
    ])];
    const calls = extractToolCalls(lines, []);
    expect(calls).toHaveLength(2);
    expect(calls[0].tool_name).toBe('Bash');
    expect(calls[0].tool_use_id).toBe('t1');
    expect(calls[1].tool_name).toBe('Edit');
    expect(calls[1].tool_use_id).toBe('t2');
    // Block index reflects position within content[], skipping non-tool_use blocks
    expect(calls[0].block_index).toBe(0);
    expect(calls[1].block_index).toBe(1);
  });

  it('extracts subagent_type only for Task tool', () => {
    const lines = [mkAssistant('m1', 0, [
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } },
      { type: 'tool_use', id: 't2', name: 'Task', input: { subagent_type: 'Explore', prompt: 'find x' } },
      { type: 'tool_use', id: 't3', name: 'Read', input: { file_path: '/x' } },
    ])];
    const calls = extractToolCalls(lines, []);
    expect(calls[0].subagent_type).toBeNull();
    expect(calls[1].subagent_type).toBe('Explore');
    expect(calls[2].subagent_type).toBeNull();
  });

  it('attributes is_error from matching user tool_result', () => {
    const aLines = [mkAssistant('m1', 0, [
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'fail' } },
      { type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'ok' } },
    ])];
    const uLines = [mkUserToolResult('t1', true, 1), mkUserToolResult('t2', false, 2)];
    const calls = extractToolCalls(aLines, uLines);
    expect(calls.find(c => c.tool_use_id === 't1')!.is_error).toBe(1);
    expect(calls.find(c => c.tool_use_id === 't2')!.is_error).toBe(0);
  });

  it('defaults is_error to 0 when no matching tool_result exists', () => {
    const aLines = [mkAssistant('m1', 0, [
      { type: 'tool_use', id: 'orphan', name: 'Bash', input: {} },
    ])];
    const calls = extractToolCalls(aLines, []);
    expect(calls[0].is_error).toBe(0);
  });

  it('detects MCP tool names', () => {
    const lines = [mkAssistant('m1', 0, [
      { type: 'tool_use', id: 't1', name: 'mcp__context7__query-docs', input: { q: 'react' } },
    ])];
    const calls = extractToolCalls(lines, []);
    // Detection itself is at the API layer; we just check the name passes through
    expect(calls[0].tool_name).toBe('mcp__context7__query-docs');
  });

  it('captures input_size as JSON.stringify(input).length', () => {
    const lines = [mkAssistant('m1', 0, [
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'echo hi' } },
    ])];
    const calls = extractToolCalls(lines, []);
    expect(calls[0].input_size).toBe(JSON.stringify({ command: 'echo hi' }).length);
  });

  it('dedupes blocks by message.id across split lines (same-message group)', () => {
    // A single assistant message split across two lines (some Claude Code
    // versions emit one line per content block); both share message.id.
    // We must walk all of them and concatenate the tool_use blocks.
    const a = mkAssistant('m1', 0, [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }]);
    const b = mkAssistant('m1', 1, [{ type: 'tool_use', id: 't2', name: 'Edit', input: {} }]);
    const calls = extractToolCalls([a, b], []);
    expect(calls).toHaveLength(2);
    expect(calls.map(c => c.tool_name).sort()).toEqual(['Bash', 'Edit']);
    // Both share turn_index 0 (same parent message)
    expect(new Set(calls.map(c => c.turn_index))).toEqual(new Set([0]));
  });
});
