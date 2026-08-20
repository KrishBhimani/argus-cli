import { tok } from '@/lib/format/format';
import { Icon } from '@/components/ui/Icon';

export type BarRow = { name: string; value: number; error?: number };

/** Horizontal bars. Label left (mono, ink-0), value right (ink-1); optional red error segment + ✕ count. */
export function Bars({ rows, format = tok, max, color = 'var(--color-s1)', className = '' }: {
  rows: BarRow[]; format?: (n: number) => string; max?: number; color?: string; className?: string;
}) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {rows.map((r) => (
        <div key={r.name} className="grid grid-cols-[minmax(0,200px)_1fr_auto] items-center gap-3 text-xs">
          <span className="font-mono text-ink-0 truncate" title={r.name}>{r.name}</span>
          <div className="relative h-1.5 rounded-sm bg-bg-3 overflow-hidden">
            <i data-testid="bar-fill" className="absolute inset-y-0 left-0 rounded-r-sm" style={{ width: `${(r.value / m) * 100}%`, background: color }} />
            {r.error ? <i data-testid="bar-error" className="absolute inset-y-0 left-0" style={{ width: `${(r.error / m) * 100}%`, background: 'var(--color-crit)' }} /> : null}
          </div>
          <span className="font-mono num text-ink-1 text-right min-w-16">
            {format(r.value)}
            {r.error ? <span className="text-crit-ink ml-2 inline-flex items-center gap-0.5"><Icon name="x" size={9} />{r.error}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
