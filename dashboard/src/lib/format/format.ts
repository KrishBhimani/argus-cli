export const usd = (n: number | null | undefined): string => {
  if (n == null) return '$—';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 100) return '$' + n.toFixed(0);
  if (n >= 1) return '$' + n.toFixed(2);
  if (n >= 0.01) return '$' + n.toFixed(3);
  return '$' + n.toFixed(4);
};

export const tok = (n: number): string => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

export const num = (n: number): string => n.toLocaleString('en-US');

export const pct = (n: number, digits = 1): string => (n * 100).toFixed(digits) + '%';

export const dur = (s: number | null): string => {
  if (s == null || s <= 0) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

export const ago = (iso: string, now: Date = new Date()): string => {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 86_400_000 * 7) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
};

export const shortDate = (iso: string, now: Date = new Date()): string => {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const fmtLocalDateTime = (iso: string): string => new Date(iso).toLocaleString();

export const shortPath = (p: string, n = 40): string => {
  if (!p) return '—';
  if (p.length <= n) return p;
  const parts = p.split(/[\\/]/);
  if (parts.length <= 2) return p.slice(0, n - 1) + '…';
  return '…/' + parts.slice(-2).join('/');
};
