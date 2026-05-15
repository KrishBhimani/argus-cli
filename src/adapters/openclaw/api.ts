import type { Hono } from 'hono';
import type { Repository } from '../../store/repository.js';

// Registers the OpenClaw-specific endpoints under /api/agents/openclaw/*.
// Filled in alongside the Phase 6 API work — adapter ships the routes so
// per-agent UI code only depends on the adapter folder.
export function registerOpenClawRoutes(app: Hono, repo: Repository) {
  // /api/agents/openclaw/named-agents — rollup by sessions.backend_agent
  app.get('/api/agents/openclaw/named-agents', (c) => {
    const window = c.req.query('window') ?? '7d';
    const days: Record<string, number | null> = { 'today': 1, '7d': 7, '30d': 30, 'all': null };
    const d = days[window] ?? 7;
    const cutoff = d ? new Date(Date.now() - d * 86_400_000).toISOString() : '';
    return c.json({
      window,
      named_agents: repo.openclawNamedAgentRollup(cutoff),
    });
  });

  // /api/agents/openclaw/providers — rollup by turns.provider
  app.get('/api/agents/openclaw/providers', (c) => {
    const window = c.req.query('window') ?? '7d';
    const days: Record<string, number | null> = { 'today': 1, '7d': 7, '30d': 30, 'all': null };
    const d = days[window] ?? 7;
    const cutoff = d ? new Date(Date.now() - d * 86_400_000).toISOString() : '';
    return c.json({
      window,
      providers: repo.openclawProviderRollup(cutoff),
    });
  });
}
