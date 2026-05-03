import { describe, it, expect } from 'vitest';
import { extractTranscriptSegments } from './extract_transcript.js';
import type { AssistantLine, UserLine } from './schemas.js';

const mkAssistant = (uuid: string, content: any[], ts = '2026-05-01T00:00:00Z'): AssistantLine => ({
  type: 'assistant',
  sessionId: 's1', uuid, timestamp: ts, cwd: '/p',
  message: {
    id: 'm-' + uuid, model: 'claude-opus-4-7', role: 'assistant',
    content,
    usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  } as any,
});

const mkUser = (uuid: string, content: any, ts = '2026-05-01T00:00:00Z'): UserLine => ({
  type: 'user',
  sessionId: 's1', uuid, timestamp: ts, cwd: '/p',
  message: { role: 'user', content } as any,
});

describe('extractTranscriptSegments', () => {
  it('emits one segment per assistant text block', () => {
    const lines = [mkAssistant('a1', [
      { type: 'text', text: 'first paragraph' },
      { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } },
      { type: 'text', text: 'second paragraph' },
    ])];
    const segs = extractTranscriptSegments(lines, []);
    expect(segs).toHaveLength(2);
    expect(segs[0].role).toBe('assistant');
    expect(segs[0].text).toBe('first paragraph');
    expect(segs[1].text).toBe('second paragraph');
    // block_index reflects original position in content[] (text=0, tool_use=1 skipped, text=2)
    expect(segs[0].uid_suffix).toBe('a1:0');
    expect(segs[1].uid_suffix).toBe('a1:2');
  });

  it('emits thinking blocks with thinking role', () => {
    const lines = [mkAssistant('a1', [
      { type: 'thinking', thinking: 'reasoning here' },
      { type: 'text', text: 'visible reply' },
    ])];
    const segs = extractTranscriptSegments(lines, []);
    expect(segs).toHaveLength(2);
    expect(segs.find(s => s.role === 'thinking')?.text).toBe('reasoning here');
    expect(segs.find(s => s.role === 'assistant')?.text).toBe('visible reply');
  });

  it('skips empty text blocks', () => {
    const lines = [mkAssistant('a1', [
      { type: 'text', text: '' },
      { type: 'text', text: '   ' },
      { type: 'text', text: 'real' },
    ])];
    const segs = extractTranscriptSegments(lines, []);
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toBe('real');
  });

  it('user message with string content emits one user segment', () => {
    const segs = extractTranscriptSegments([], [mkUser('u1', 'hi there')]);
    expect(segs).toHaveLength(1);
    expect(segs[0].role).toBe('user');
    expect(segs[0].text).toBe('hi there');
    expect(segs[0].uid_suffix).toBe('u1:0');
  });

  it('user tool_result content is captured under tool_result role', () => {
    const segs = extractTranscriptSegments([], [
      mkUser('u1', [
        { type: 'tool_result', tool_use_id: 't1', content: 'command output' },
      ]),
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0].role).toBe('tool_result');
    expect(segs[0].text).toBe('command output');
  });

  it('user tool_result with array content is flattened to one segment', () => {
    const segs = extractTranscriptSegments([], [
      mkUser('u1', [
        { type: 'tool_result', tool_use_id: 't1', content: [
          { type: 'text', text: 'line one' },
          { type: 'text', text: 'line two' },
        ]},
      ]),
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toContain('line one');
    expect(segs[0].text).toContain('line two');
  });

  it('caps oversized text at 16 KB with ellipsis suffix', () => {
    const huge = 'x'.repeat(50_000);
    const lines = [mkAssistant('a1', [{ type: 'text', text: huge }])];
    const segs = extractTranscriptSegments(lines, []);
    expect(segs[0].text.length).toBeLessThan(huge.length);
    expect(segs[0].text.endsWith('…')).toBe(true);
  });

  it('preserves chronological pairing across both lists', () => {
    const a1 = mkAssistant('a1', [{ type: 'text', text: 'reply' }], '2026-05-01T00:00:01Z');
    const u1 = mkUser('u1', 'question', '2026-05-01T00:00:00Z');
    const segs = extractTranscriptSegments([a1], [u1]);
    expect(segs.find(s => s.role === 'user')?.timestamp).toBe('2026-05-01T00:00:00Z');
    expect(segs.find(s => s.role === 'assistant')?.timestamp).toBe('2026-05-01T00:00:01Z');
  });
});
