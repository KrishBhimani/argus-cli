import { readdir, stat } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

export async function discoverSessionFiles(claudeRoot: string): Promise<string[]> {
  const projectsDir = join(claudeRoot, 'projects');
  if (!existsSync(projectsDir)) return [];
  const out: string[] = [];
  for (const entry of await readdir(projectsDir)) {
    const projDir = join(projectsDir, entry);
    if (!(await stat(projDir)).isDirectory()) continue;
    for (const f of await readdir(projDir)) {
      if (f.endsWith('.jsonl')) out.push(join(projDir, f));
    }
  }
  return out;
}

export function subAgentFilesFor(sessionFile: string): string[] {
  const dir = dirname(sessionFile);
  const sid = basename(sessionFile, '.jsonl');
  const sub = join(dir, sid, 'subagents');
  if (!existsSync(sub)) return [];
  return readdirSync(sub).filter(f => f.endsWith('.jsonl')).map(f => join(sub, f));
}
