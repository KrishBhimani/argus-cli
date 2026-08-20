import type { Session } from '@/lib/api/client';

// candidate-endpoint: token composition per window could come from /api/overview.
export function composition(sessions: Session[]) {
  const c = { fresh: 0, cacheWrite: 0, cacheRead: 0, output: 0, total: 0 };
  for (const s of sessions) {
    c.fresh += s.total_fresh_input_tokens;
    c.cacheWrite += s.total_cache_write_tokens;
    c.cacheRead += s.total_cache_read_tokens;
    c.output += s.total_output_tokens;
  }
  c.total = c.fresh + c.cacheWrite + c.cacheRead + c.output;
  return c;
}
