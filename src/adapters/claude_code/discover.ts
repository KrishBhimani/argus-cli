import { readdir, stat, realpath } from 'node:fs/promises';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, dirname, basename, sep } from 'node:path';

// Constrain a candidate path to live under the canonical root. realpath
// resolves all symlinks; a hostile link planted at
// ~/.claude/projects/foo/leak.jsonl that points to /etc/passwd would
// canonicalize OUTSIDE the claudeRoot tree, so we reject it. Returns
// null when the path can't be resolved (e.g. dangling symlink) — also
// safe to skip.
async function safeRealpathUnder(candidate: string, canonicalRoot: string): Promise<string | null> {
  try {
    const resolved = await realpath(candidate);
    // Ensure the resolved path is the root itself or a descendant.
    // Without the trailing separator we could match e.g.
    // /home/user/.claudemalicious/x against /home/user/.claude.
    if (resolved === canonicalRoot) return resolved;
    if (resolved.startsWith(canonicalRoot + sep)) return resolved;
    return null;
  } catch {
    return null;
  }
}

export async function discoverSessionFiles(claudeRoot: string): Promise<string[]> {
  const projectsDir = join(claudeRoot, 'projects');
  if (!existsSync(projectsDir)) return [];
  // Canonicalize the root once. All subsequent realpath checks compare
  // against this so we don't have to handle WSL/Cygwin path quirks per
  // candidate.
  let canonicalRoot: string;
  try { canonicalRoot = realpathSync(claudeRoot); }
  catch { return []; }
  const out: string[] = [];
  for (const entry of await readdir(projectsDir)) {
    const projDir = join(projectsDir, entry);
    if (!(await stat(projDir)).isDirectory()) continue;
    for (const f of await readdir(projDir)) {
      if (!f.endsWith('.jsonl')) continue;
      const full = join(projDir, f);
      // Only emit the path if it canonicalizes UNDER the claude root.
      // Symlinks outside that tree (e.g. → /etc/passwd) get dropped
      // silently rather than read.
      const safe = await safeRealpathUnder(full, canonicalRoot);
      if (safe) out.push(full);
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
