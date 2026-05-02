import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ingestHistoryFile, lineToPrompt } from './history_jsonl.js';
import { openDb } from '../../store/db.js';
import { Repository, normalizeProjectPath } from '../../store/repository.js';

describe('lineToPrompt', () => {
  it('skips empty/whitespace-only display', () => {
    expect(lineToPrompt({ display: '', pastedContents: {}, timestamp: 1, project: '/p' })).toBeNull();
    expect(lineToPrompt({ display: '   ', pastedContents: {}, timestamp: 1, project: '/p' })).toBeNull();
  });

  it('flags slash commands', () => {
    const r = lineToPrompt({ display: '/exit', pastedContents: {}, timestamp: 1, project: '/p' });
    expect(r?.is_slash).toBe(1);
    const r2 = lineToPrompt({ display: 'hello', pastedContents: {}, timestamp: 1, project: '/p' });
    expect(r2?.is_slash).toBe(0);
  });

  it('normalizes Windows project path', () => {
    const r = lineToPrompt({
      display: 'hi', pastedContents: {}, timestamp: 1,
      project: 'C:\\documents\\GEN AI\\My Project',
    });
    expect(r?.project_path).toBe(normalizeProjectPath('C:\\documents\\GEN AI\\My Project'));
    expect(r?.project_path).not.toContain('\\');
  });

  it('records pasted_chars > 0 only when pastedContents has content', () => {
    const empty = lineToPrompt({ display: 'hi', pastedContents: {}, timestamp: 1, project: '/p' });
    expect(empty?.pasted_chars).toBe(0);
    const withPaste = lineToPrompt({
      display: 'hi', pastedContents: { 1: { content: 'large' } },
      timestamp: 1, project: '/p',
    });
    expect(withPaste!.pasted_chars).toBeGreaterThan(0);
  });

  it('truncates display past 8 KB cap', () => {
    const huge = 'x'.repeat(20_000);
    const r = lineToPrompt({ display: huge, pastedContents: {}, timestamp: 1, project: '/p' });
    expect(r!.display.length).toBeLessThan(huge.length);
    expect(r!.display.endsWith('…')).toBe(true);
  });

  it('preserves leading-slash detection through trimStart', () => {
    const r = lineToPrompt({ display: '   /clear', pastedContents: {}, timestamp: 1, project: '/p' });
    expect(r?.is_slash).toBe(1);
  });
});

describe('ingestHistoryFile', () => {
  let tmp: string;
  let db: any;
  let repo: Repository;
  let path: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'argus-history-'));
    db = openDb(join(tmp, 'argus.db'));
    repo = new Repository(db);
    path = join(tmp, 'history.jsonl');
  });

  it('reads new bytes only on subsequent calls (byte-offset tail)', async () => {
    writeFileSync(path, JSON.stringify({ display: 'hello', pastedContents: {}, timestamp: 1000, project: '/p' }) + '\n');
    const first = await ingestHistoryFile(path, repo);
    expect(first.inserted).toBe(1);

    appendFileSync(path, JSON.stringify({ display: 'world', pastedContents: {}, timestamp: 2000, project: '/p' }) + '\n');
    const second = await ingestHistoryFile(path, repo);
    expect(second.inserted).toBe(1);

    const stats = repo.promptStats();
    expect(stats.total).toBe(2);
  });

  it('holds back partial last line until newline arrives', async () => {
    // Write a complete line + a partial second line.
    const complete = JSON.stringify({ display: 'a', pastedContents: {}, timestamp: 1000, project: '/p' }) + '\n';
    const partial = '{"display":"b","timestamp":2000,"project":"/p"';
    writeFileSync(path, complete + partial);

    const r1 = await ingestHistoryFile(path, repo);
    expect(r1.inserted).toBe(1);

    // Append the close-brace + newline to complete the second line.
    appendFileSync(path, ',"pastedContents":{}}\n');
    const r2 = await ingestHistoryFile(path, repo);
    expect(r2.inserted).toBe(1);
  });

  it('skips malformed lines and continues', async () => {
    const lines = [
      JSON.stringify({ display: 'good', pastedContents: {}, timestamp: 1, project: '/p' }),
      'not-json',
      JSON.stringify({ display: 'good2', pastedContents: {}, timestamp: 2, project: '/p' }),
    ];
    writeFileSync(path, lines.join('\n') + '\n');
    const r = await ingestHistoryFile(path, repo);
    expect(r.inserted).toBe(2);
    expect(r.parse_errors).toBe(1);
  });

  it('resets offset and re-ingests when file shrinks below recorded offset', async () => {
    // Write three long lines to push the offset well past anything a single-
    // line replacement file would reach.
    const big = 'x'.repeat(500);
    writeFileSync(path, [
      JSON.stringify({ display: big + ' a', pastedContents: {}, timestamp: 1, project: '/p' }),
      JSON.stringify({ display: big + ' b', pastedContents: {}, timestamp: 2, project: '/p' }),
      JSON.stringify({ display: big + ' c', pastedContents: {}, timestamp: 3, project: '/p' }),
    ].join('\n') + '\n');
    const first = await ingestHistoryFile(path, repo);
    expect(first.inserted).toBe(3);

    // Replace with a tiny file — much smaller than the recorded offset.
    writeFileSync(path, JSON.stringify({ display: 'fresh', pastedContents: {}, timestamp: 4, project: '/p' }) + '\n');
    const r = await ingestHistoryFile(path, repo);
    expect(r.inserted).toBe(1);
  });

  it('FTS5 search returns matches with snippet markers', async () => {
    writeFileSync(path, [
      JSON.stringify({ display: 'how do I configure vitest', pastedContents: {}, timestamp: 1, project: '/p' }),
      JSON.stringify({ display: 'unrelated prompt', pastedContents: {}, timestamp: 2, project: '/p' }),
      JSON.stringify({ display: 'vitest hangs in CI', pastedContents: {}, timestamp: 3, project: '/p' }),
    ].join('\n') + '\n');
    await ingestHistoryFile(path, repo);

    const result = repo.searchPrompts({ q: 'vitest', limit: 10 });
    expect(result.total).toBe(2);
    for (const row of result.rows) {
      expect(row.snippet).toMatch(/<mark>/);
    }
  });

  it('searchPrompts with empty q returns chronological recents', async () => {
    writeFileSync(path, [
      JSON.stringify({ display: 'old', pastedContents: {}, timestamp: 1000, project: '/p' }),
      JSON.stringify({ display: 'middle', pastedContents: {}, timestamp: 2000, project: '/p' }),
      JSON.stringify({ display: 'newest', pastedContents: {}, timestamp: 3000, project: '/p' }),
    ].join('\n') + '\n');
    await ingestHistoryFile(path, repo);

    const result = repo.searchPrompts({ limit: 10 });
    expect(result.rows[0].display).toBe('newest');
    expect(result.rows[2].display).toBe('old');
  });

  it('default search excludes slash commands; includeSlash brings them back', async () => {
    writeFileSync(path, [
      JSON.stringify({ display: '/exit', pastedContents: {}, timestamp: 1, project: '/p' }),
      JSON.stringify({ display: 'real prompt', pastedContents: {}, timestamp: 2, project: '/p' }),
    ].join('\n') + '\n');
    await ingestHistoryFile(path, repo);

    expect(repo.searchPrompts({ limit: 10 }).total).toBe(1);
    expect(repo.searchPrompts({ limit: 10, includeSlash: true }).total).toBe(2);
  });
});
