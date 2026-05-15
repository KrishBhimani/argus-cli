// Multi-agent filter + manifest helpers.
//
// The API is the contract: /api/agents drives the nav dropdown and the
// global filter picker. This file just persists the user's filter choice
// in localStorage, syncs it with the URL query string, and provides a
// helper that any fetch can route through to apply it. No hardcoded
// agent names; everything flows from the manifest response.

export type AgentFilter = { agent?: string; backendAgent?: string };

export interface AgentInfo {
  name: string;
  display_name: string;
  capabilities: {
    reportsNativeCost: boolean;
    hasToolCalls: boolean;
    hasTranscriptSegments: boolean;
    hasPrompts: boolean;
  };
  backend_agents: string[] | null;
  page_path: string;
}

const STORAGE_KEY = 'argus.agentFilter';

// URL wins over localStorage so deep links override the persisted choice.
export function getFilter(): AgentFilter {
  if (typeof window === 'undefined') return {};
  const u = new URL(window.location.href);
  const a = u.searchParams.get('agent') ?? undefined;
  const b = u.searchParams.get('backend_agent') ?? undefined;
  if (a || b) return { agent: a, backendAgent: b };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      agent: typeof parsed.agent === 'string' ? parsed.agent : undefined,
      backendAgent: typeof parsed.backendAgent === 'string' ? parsed.backendAgent : undefined,
    };
  } catch { return {}; }
}

export function setFilter(f: AgentFilter): void {
  if (typeof window === 'undefined') return;
  try {
    if (f.agent || f.backendAgent) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* storage full / disabled — non-fatal */ }
  // Reflect in URL so navigation back/forward is consistent.
  const u = new URL(window.location.href);
  if (f.agent) u.searchParams.set('agent', f.agent);
  else u.searchParams.delete('agent');
  if (f.backendAgent) u.searchParams.set('backend_agent', f.backendAgent);
  else u.searchParams.delete('backend_agent');
  window.history.replaceState({}, '', u.toString());
  window.dispatchEvent(new CustomEvent('argus:filter-changed', { detail: f }));
}

// Append filter params to a URL string. Pass through query strings that
// already exist; this just adds two params or none.
export function withFilter(url: string): string {
  const f = getFilter();
  if (!f.agent && !f.backendAgent) return url;
  const sep = url.includes('?') ? '&' : '?';
  const parts: string[] = [];
  if (f.agent) parts.push(`agent=${encodeURIComponent(f.agent)}`);
  if (f.backendAgent) parts.push(`backend_agent=${encodeURIComponent(f.backendAgent)}`);
  return url + sep + parts.join('&');
}

// Memoized /api/agents fetch — the manifest doesn't change while the
// dashboard is up (adding a new backend requires a restart).
let _cache: Promise<AgentInfo[]> | null = null;
export function loadAgents(): Promise<AgentInfo[]> {
  if (!_cache) {
    _cache = fetch('/api/agents')
      .then(r => r.json() as Promise<{ agents: AgentInfo[] }>)
      .then(j => j.agents);
  }
  return _cache;
}
