import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Adapter } from './adapter.js';
import { ClaudeCodeAdapter } from './claude_code/index.js';
import { OpenClawAdapter } from './openclaw/index.js';

// All known adapters. Add a line here to register a new backend — the
// rest of Argus (pipeline, server, dashboard) discovers it through this
// list and the adapter's declared capabilities. See
// CONTRIBUTING.md → "Adding a new agent backend".
export function loadAdapters(home: string = homedir()): Adapter[] {
  const candidates: Array<() => Adapter | null> = [
    () => {
      const root = join(home, '.claude');
      return existsSync(root) ? new ClaudeCodeAdapter(root) : null;
    },
    () => {
      const root = join(home, '.openclaw');
      return existsSync(root) ? new OpenClawAdapter(root) : null;
    },
  ];
  return candidates
    .map(f => f())
    .filter((a): a is Adapter => a !== null);
}
