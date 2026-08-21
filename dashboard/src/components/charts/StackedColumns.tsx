import { useState } from 'react';
import { Legend } from './Legend';
import { SERIES } from './uplotTheme';
import { num } from '@/lib/format/format';

export type StackSeries = { name: string; values: number[] };

/** Discrete per-bucket counts as stacked columns (2 px surface gaps). Good for sparse daily data. */
export function StackedColumns({ labels, series, height = 220, format = num, className = '' }: {
  labels: string[]; series: StackSeries[]; height?: number; format?: (n: number) => string; className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const W = 1000, H = height, padL = 44, padB = 22, padT = 8;
  const plotW = W - padL - 8, plotH = H - padT - padB;
  const step = plotW / Math.max(1, n);
  const bw = Math.max(2, Math.min(28, step * 0.7));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const labelEvery = Math.max(1, Math.ceil(n / 12));
  return (
    <div className={`flex flex-col gap-2 min-w-0 ${className}`}>
      {series.length >= 2 && <Legend names={series.map((s) => s.name)} colors={series.map((_, i) => SERIES[i % SERIES.length])} />}
      <div className="relative">
        <svg className="block w-full" viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label="Stacked columns" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="#232934" />
              <text x={padL - 6} y={y(t) + 3} fontSize={10} textAnchor="end" fill="#667184" fontFamily="var(--font-mono)">{format(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => {
            const x = padL + i * step + (step - bw) / 2;
            let acc = 0;
            return (
              <g key={l} onMouseEnter={() => setHover(i)}>
                <rect x={padL + i * step} y={padT} width={step} height={plotH} fill={hover === i ? 'rgba(255,255,255,0.04)' : 'transparent'} />
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  if (v <= 0) return null;
                  const y0 = y(acc + v), h = Math.max(0, y(acc) - y(acc + v) - 2);
                  acc += v;
                  return <rect key={s.name} x={x} y={y0} width={bw} height={h} rx={si === series.length - 1 || acc === totals[i] ? 2 : 0} fill={SERIES[si % SERIES.length]} />;
                })}
                {i % labelEvery === 0 && <text x={padL + i * step + step / 2} y={H - 6} fontSize={10} textAnchor="middle" fill="#667184" fontFamily="var(--font-mono)">{l.slice(5)}</text>}
              </g>
            );
          })}
        </svg>
        {hover != null && (
          <div className="absolute top-1 right-1 text-[11px] bg-bg-3 border border-line-2 rounded-md px-2.5 py-1.5 pointer-events-none shadow-lg flex flex-col gap-0.5 font-mono">
            <span className="text-ink-0">{labels[hover]} · {format(totals[hover])}</span>
            {series.map((s, si) => (s.values[hover] ? <span key={s.name} className="text-ink-1 flex items-center gap-1.5"><b className="w-2 h-2 rounded-[2px] inline-block" style={{ background: SERIES[si % SERIES.length] }} />{s.name} <span className="ml-auto pl-3 text-ink-0">{format(s.values[hover])}</span></span> : null))}
          </div>
        )}
      </div>
    </div>
  );
}
