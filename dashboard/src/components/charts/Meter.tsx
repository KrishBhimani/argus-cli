import { pct } from '@/lib/format/format';

/** Single stacked bar with 2 px surface gaps + legend with shares. */
export function Meter({ parts, className = '' }: { parts: { name: string; value: number; color: string }[]; className?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex h-2 rounded-sm overflow-hidden gap-[2px] bg-bg-0">
        {parts.map((p) => <i key={p.name} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-1">
        {parts.map((p) => (
          <span key={p.name} className="inline-flex items-center gap-1.5">
            <b className="w-2 h-2 rounded-[2px] inline-block" style={{ background: p.color }} />
            {p.name} <span className="font-mono text-ink-0">{pct(p.value / total, 0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
