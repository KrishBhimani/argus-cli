import { readdir, stat, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';

// Returns the canonical session id for a file we should count, or null to
// skip. Matches OpenClaw's isUsageCountedSessionTranscriptFileName:
//   <sid>.jsonl                         → count (active)
//   <sid>.jsonl.reset.<iso>             → count (compacted archive)
//   <sid>.jsonl.deleted.<iso>           → count (deleted archive)
//   <sid>.jsonl.bak.<iso>               → SKIP (manual backup)
//   <sid>.checkpoint.<uuid>.jsonl       → SKIP (mid-run checkpoint)
//
// Without the archive variants we'd undercount tokens ~10x vs the OpenClaw
// dashboard (every compacted/deleted session would drop out). The Python
// reference (xo-cowork-api/routers/cowork_agent/usage.py) documents this.
export function openclawSessionIdFromFilename(name: string): string | null {
  if (!name) return null;
  for (const marker of ['.jsonl.reset.', '.jsonl.deleted.']) {
    const idx = name.indexOf(marker);
    if (idx > 0) return name.slice(0, idx);
  }
  if (name.endsWith('.jsonl') && !name.includes('.checkpoint.')) {
    const base = name.slice(0, -'.jsonl'.length);
    if (!base) return null;
    return base;
  }
  return null;
}

// Same Windows case-normalization story as the Claude Code adapter — see
// adapters/claude_code/discover.ts for the saga in commit 43f28c2.
const IS_WINDOWS = process.platform === 'win32';
const normalize = (p: string) => IS_WINDOWS ? p.toLowerCase() : p;

async function safeRealpathUnder(candidate: string, canonicalRoot: string): Promise<string | null> {
  try {
    const resolved = await realpath(candidate);
    const a = normalize(resolved);
    const b = normalize(canonicalRoot);
    if (a === b) return resolved;
    if (a.startsWith(b + sep)) return resolved;
    return null;
  } catch {
    return null;
  }
}

// Walk ~/.openclaw/agents/<name>/sessions/ for every file that
// openclawSessionIdFromFilename accepts. Symlink-canonicalized so a
// hostile link planted in sessions/ that points outside the root gets
// rejected before we open it.
export async function discoverOpenClawSessionFiles(openclawRoot: string): Promise<string[]> {
  const agentsDir = join(openclawRoot, 'agents');
  if (!existsSync(agentsDir)) return [];
  let canonicalRoot: string;
  try { canonicalRoot = await realpath(openclawRoot); }
  catch { return []; }

  const out: string[] = [];
  for (const agentName of await readdir(agentsDir)) {
    const agentDir = join(agentsDir, agentName);
    try {
      if (!(await stat(agentDir)).isDirectory()) continue;
    } catch { continue; }
    const sessionsDir = join(agentDir, 'sessions');
    if (!existsSync(sessionsDir)) continue;
    for (const f of await readdir(sessionsDir)) {
      if (openclawSessionIdFromFilename(f) === null) continue;
      const full = join(sessionsDir, f);
      const safe = await safeRealpathUnder(full, canonicalRoot);
      if (safe) out.push(full);
    }
  }
  return out;
}

// Distinct named agents found under <root>/agents/. Used by the adapter's
// listBackendAgents() implementation to populate /api/agents.backend_agents.
export async function discoverOpenClawBackendAgents(openclawRoot: string): Promise<string[]> {
  const agentsDir = join(openclawRoot, 'agents');
  if (!existsSync(agentsDir)) return [];
  const out: string[] = [];
  for (const name of await readdir(agentsDir)) {
    const full = join(agentsDir, name);
    try {
      if ((await stat(full)).isDirectory()) out.push(name);
    } catch { /* ignore */ }
  }
  return out.sort();
}

// Return the named-agent directory containing this session file. Used to
// populate sessions.backend_agent during ingest.
export function namedAgentFromPath(filePath: string): string | null {
  // Path looks like <root>/agents/<named>/sessions/<file>.jsonl[.…]
  const parts = filePath.split(sep);
  const sIdx = parts.lastIndexOf('sessions');
  if (sIdx < 1) return null;
  return parts[sIdx - 1] || null;
}
