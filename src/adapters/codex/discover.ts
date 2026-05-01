import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export async function discoverCodexSessionFiles(codexRoot: string): Promise<string[]> {
  const sessions = join(codexRoot, 'sessions');
  if (!existsSync(sessions)) return [];
  const out: string[] = [];
  async function walk(d: string) {
    for (const e of await readdir(d)) {
      const p = join(d, e);
      const st = await stat(p);
      if (st.isDirectory()) await walk(p);
      else if (e.endsWith('.jsonl')) out.push(p);
    }
  }
  await walk(sessions);
  return out;
}
