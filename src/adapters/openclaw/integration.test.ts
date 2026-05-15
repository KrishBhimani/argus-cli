import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OpenClawAdapter } from './index.js';

const FIXTURE = new URL('./__fixtures__/sample-session.jsonl', import.meta.url).pathname;

describe('OpenClawAdapter (integration)', () => {
  it('exposes the expected agent + capabilities', () => {
    const a = new OpenClawAdapter('/nonexistent');
    expect(a.agent).toBe('openclaw');
    expect(a.displayName).toBe('OpenClaw');
    expect(a.capabilities).toEqual({
      reportsNativeCost: true,
      hasToolCalls: true,
      hasTranscriptSegments: false,
      hasPrompts: false,
    });
  });

  it('discovers session files under agents/<name>/sessions/', async () => {
    const root = mkdtempSync(join(tmpdir(), 'oc-'));
    mkdirSync(join(root, 'agents', 'main', 'sessions'), { recursive: true });
    mkdirSync(join(root, 'agents', 'dev', 'sessions'), { recursive: true });
    copyFileSync(FIXTURE, join(root, 'agents', 'main', 'sessions', 'a.jsonl'));
    copyFileSync(FIXTURE, join(root, 'agents', 'main', 'sessions', 'a.jsonl.reset.2026-05-01T00-00-00.000Z'));
    copyFileSync(FIXTURE, join(root, 'agents', 'main', 'sessions', 'a.jsonl.bak.2026-05-01T00-00-00.000Z'));
    copyFileSync(FIXTURE, join(root, 'agents', 'main', 'sessions', 'a.checkpoint.deadbeef.jsonl'));
    copyFileSync(FIXTURE, join(root, 'agents', 'dev', 'sessions', 'b.jsonl'));

    const a = new OpenClawAdapter(root);
    const files = await a.discoverSessionFiles();
    // Expect: a.jsonl + a.jsonl.reset.* (main), b.jsonl (dev). Skip .bak and .checkpoint.
    expect(files).toHaveLength(3);
    expect(files.some(f => f.endsWith('a.jsonl'))).toBe(true);
    expect(files.some(f => f.includes('.jsonl.reset.'))).toBe(true);
    expect(files.some(f => f.endsWith('b.jsonl'))).toBe(true);
    expect(files.some(f => f.includes('.bak.'))).toBe(false);
    expect(files.some(f => f.includes('.checkpoint.'))).toBe(false);
  });

  it('lists backend agents (named subdirectories)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'oc-'));
    mkdirSync(join(root, 'agents', 'main'), { recursive: true });
    mkdirSync(join(root, 'agents', 'dev'), { recursive: true });
    mkdirSync(join(root, 'agents', 'admin'), { recursive: true });

    const a = new OpenClawAdapter(root);
    const names = await a.listBackendAgents();
    expect(names).toEqual(['admin', 'dev', 'main']);
  });

  it('ingests the fixture end-to-end', async () => {
    const root = mkdtempSync(join(tmpdir(), 'oc-'));
    mkdirSync(join(root, 'agents', 'main', 'sessions'), { recursive: true });
    const target = join(root, 'agents', 'main', 'sessions', '067e3c96.jsonl');
    copyFileSync(FIXTURE, target);

    const a = new OpenClawAdapter(root);
    const { result, new_offset } = await a.ingestFile(target);
    expect(new_offset).toBeGreaterThan(0);

    // Header
    expect(result.header.agent).toBe('openclaw');
    expect(result.header.native_session_id).toBe('main:067e3c96');
    expect(result.header.backend_agent).toBe('main');
    expect(result.header.project_path).toBe('/home/coder/.openclaw/workspace');
    expect(result.header.started_at).toBe('2026-05-08T12:30:35.057Z');
    expect(result.header.pricing_table_version_override).toBe('openclaw-reported');
    expect((result.header.metadata as { title?: string }).title).toBe('List the files in this folder');

    // Turns: two assistant messages with usage
    expect(result.turns).toHaveLength(2);
    expect(result.turns[0].fresh_input_tokens).toBe(120);
    expect(result.turns[0].cost_usd_override).toBe(0.003);
    expect(result.turns[0].provider).toBe('kimi');
    expect(result.turns[0].tool_calls_count).toBe(1);
    expect(result.turns[1].cost_usd_override).toBe(0.0008);  // scalar cost variant

    // Agent-reported cost is the sum
    expect(result.header.agent_reported_cost_usd).toBeCloseTo(0.0038);

    // Tool calls
    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls![0].tool_name).toBe('read');
    expect(result.tool_calls![0].is_error).toBe(0);
  });
});
