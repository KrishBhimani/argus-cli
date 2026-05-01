import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSessionFiles, subAgentFilesFor } from './discover.js';

describe('discoverSessionFiles', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'argus-claude-')); });

  it('finds top-level .jsonl files', async () => {
    const proj = join(root, 'projects', 'C--proj');
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, 's1.jsonl'), '{}\n');
    writeFileSync(join(proj, 's2.jsonl'), '{}\n');
    writeFileSync(join(proj, 'sessions-index.json'), '[]');
    const files = await discoverSessionFiles(root);
    expect(files.filter(f => f.endsWith('.jsonl')).length).toBe(2);
    expect(files.find(f => f.endsWith('sessions-index.json'))).toBeUndefined();
  });

  it('returns sub-agent files for a session', () => {
    const proj = join(root, 'projects', 'C--proj');
    const subdir = join(proj, 's1', 'subagents');
    mkdirSync(subdir, { recursive: true });
    writeFileSync(join(subdir, 'agent-aabc.jsonl'), '{}\n');
    writeFileSync(join(subdir, 'agent-acompact-def.jsonl'), '{}\n');
    const subs = subAgentFilesFor(join(proj, 's1.jsonl'));
    expect(subs.length).toBe(2);
  });

  it('returns empty array when no subagents dir exists', () => {
    const proj = join(root, 'projects', 'C--proj');
    mkdirSync(proj, { recursive: true });
    expect(subAgentFilesFor(join(proj, 's1.jsonl'))).toEqual([]);
  });
});
