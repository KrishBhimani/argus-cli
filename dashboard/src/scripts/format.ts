export const usd = (n: number | null | undefined) => {
  if (n == null) return '$—';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 100) return '$' + n.toFixed(0);
  if (n >= 10) return '$' + n.toFixed(2);
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(3);
  return '$' + n.toFixed(4);
};

export const tok = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

export const num = (n: number) => n.toLocaleString('en-US');

export const dur = (s: number | null) => {
  if (s == null || s <= 0) return '—';
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
};

export const ago = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + 'm ago';
  if (ms < 86_400_000) return Math.floor(ms / 3_600_000) + 'h ago';
  if (ms < 86_400_000 * 7) return Math.floor(ms / 86_400_000) + 'd ago';
  return new Date(iso).toLocaleDateString();
};

export const shortDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const shortPath = (p: string, n = 40) => {
  if (!p) return '—';
  if (p.length <= n) return p;
  const parts = p.split(/[\\/]/);
  if (parts.length <= 2) return p.slice(0, n - 1) + '…';
  const tail = parts.slice(-2).join('/');
  return '…/' + tail;
};

// Renders a tag for any agent backend. Display labels flow from the
// /api/agents manifest (loadAgents() in scripts/agents.ts) — pages that
// have access to the manifest should pass the resolved display_name in.
// Without context, we fall back to a CSS-safe slug of the raw agent id.
export const agentTag = (a: string, displayLabel?: string) => {
  const label = displayLabel ?? a;
  const slug = String(a).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `<span class="tag tag-${slug}">${label}</span>`;
};

// Escape every HTML-special character so a string can be safely inserted
// via innerHTML. ALWAYS use this for any value sourced from JSONL files
// (model names, project paths, session ids, agent_version strings, tool
// names, group keys, bucket labels, pricing version) — those bytes are
// outside our control and any one of them could carry a script tag.
//
// FTS5 snippet output is a different beast (it embeds <mark> tags by
// design); use safeSnippet() for that, not this. Anything else: this.
export function escapeHtml(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
