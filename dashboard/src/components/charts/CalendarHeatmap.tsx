import { dayKeys } from '@/lib/analysis/windows';
import { tok } from '@/lib/format/format';
import { rampColor } from './ramp';

/** GitHub-style weeks × weekdays grid; one-hue ramp. */
export function CalendarHeatmap({ byDay, days = 90, end = new Date(), className = '' }: {
  byDay: Record<string, number>; days?: number; end?: Date; className?: string;
}) {
  const keys = dayKeys(end, days);
  const max = Math.max(1, ...keys.map((k) => byDay[k] ?? 0));
  const startDow = (new Date(keys[0] + 'T00:00:00').getDay() + 6) % 7; // Mon=0
  const cell = 11, gap = 2, weeks = Math.ceil((days + startDow) / 7);
  return (
    <svg className={className} width="100%" viewBox={`0 0 ${weeks * (cell + gap) + 28} ${7 * (cell + gap) + 4}`} role="img" aria-label={`Activity, last ${days} days`}>
      {['M', 'W', 'F'].map((l, i) => (
        <text key={l} x={0} y={i * 2 * (cell + gap) + cell} fontSize={9} fill="#667184" fontFamily="var(--font-mono)">{l}</text>
      ))}
      {keys.map((k, i) => {
        const idx = i + startDow;
        const x = 24 + Math.floor(idx / 7) * (cell + gap), y = (idx % 7) * (cell + gap);
        const v = byDay[k] ?? 0;
        return (
          <rect key={k} data-day={k} x={x} y={y} width={cell} height={cell} rx={2} fill={rampColor(v, max)}>
            <title>{`${k} · ${tok(v)} tokens`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
