import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ingestClaudeCodeFile } from './ingest_file.js';

function jsonl(lines: object[]) { return lines.map(l => JSON.stringify(l)).join('\n') + '\n'; }

const ASSISTANT = (id: string, msgId: string) => ({
  type: 'assistant', sessionId: 's1', uuid: id, timestamp: '2026-05-01T00:00:00Z',
  cwd: 'C:/proj', version: '2.1.94', userType: 'external', entrypoint: 'cli',
  message: {
    id: msgId, model: 'claude-opus-4-7', role: 'assistant', content: [],
    usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  },
});

describe('ingestClaudeCodeFile', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'argus-')); });

  it('parses a fresh file from offset 0', async () => {
    const f = join(dir, 's1.jsonl');
    writeFileSync(f, jsonl([ASSISTANT('u1', 'm1'), ASSISTANT('u2', 'm2')]));
    const { result, new_offset } = await ingestClaudeCodeFile(f);
    expect(result.turns).toHaveLength(2);
    expect(new_offset).toBeGreaterThan(0);
    expect(result.parse_errors).toHaveLength(0);
  });

  it('respects the from_offset and only parses new tail', async () => {
    const f = join(dir, 's1.jsonl');
    writeFileSync(f, jsonl([ASSISTANT('u1', 'm1')]));
    const a = await ingestClaudeCodeFile(f);
    appendFileSync(f, jsonl([ASSISTANT('u2', 'm2')]));
    const b = await ingestClaudeCodeFile(f, a.new_offset);
    expect(b.result.turns).toHaveLength(1);
    expect(b.result.turns[0].native_turn_id).toBe('m2');
  });

  it('records parse error for malformed line, continues with rest', async () => {
    const f = join(dir, 's1.jsonl');
    writeFileSync(f, JSON.stringify(ASSISTANT('u1', 'm1')) + '\n{ broken json\n' + JSON.stringify(ASSISTANT('u2', 'm2')) + '\n');
    const { result } = await ingestClaudeCodeFile(f);
    expect(result.turns).toHaveLength(2);
    expect(result.parse_errors).toHaveLength(1);
  });

  it('preserves partial trailing line for next ingest', async () => {
    const f = join(dir, 's1.jsonl');
    writeFileSync(f, JSON.stringify(ASSISTANT('u1', 'm1')) + '\n' + '{"type":"assist');
    const a = await ingestClaudeCodeFile(f);
    expect(a.result.turns).toHaveLength(1);
    appendFileSync(f, 'ant","sessionId":"s1","uuid":"u2","timestamp":"2026-05-01T00:00:00Z","cwd":"C:/proj","message":{"id":"m2","model":"claude-opus-4-7","role":"assistant","content":[],"usage":{"input_tokens":1,"output_tokens":1,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}}\n');
    const b = await ingestClaudeCodeFile(f, a.new_offset);
    expect(b.result.turns).toHaveLength(1);
    expect(b.result.turns[0].native_turn_id).toBe('m2');
  });

  it('builds session header from cwd field, not encoded dir', async () => {
    const f = join(dir, 's1.jsonl');
    writeFileSync(f, jsonl([ASSISTANT('u1', 'm1')]));
    const { result } = await ingestClaudeCodeFile(f);
    expect(result.header.project_path).toBe('C:/proj');
    expect(result.header.agent).toBe('claude_code');
  });
});
