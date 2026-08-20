import { useMemo, useState } from 'react';
import type uPlot from 'uplot';
import { UPlotChart, type UPlotOptions } from './UPlotChart';
import { Legend } from './Legend';
import { AXIS, SERIES } from './uplotTheme';

export type ScatterPoint = { x: number; y: number; label: string; group: string };

/** One series per group (≤5 + Other), 8 px markers with a surface ring; hover shows the point label. */
export function Scatter({ points, xLabel, yLabel, logX = false, logY = false, formatX = String, formatY = String, height = 220 }: {
  points: ScatterPoint[]; xLabel: string; yLabel: string; logX?: boolean; logY?: boolean;
  formatX?: (n: number) => string; formatY?: (n: number) => string; height?: number;
}) {
  const [tip, setTip] = useState<string | null>(null);
  // uPlot mode 1 wants x ascending; sort once and keep labels aligned.
  const sorted = useMemo(() => [...points].sort((a, b) => a.x - b.x), [points]);
  const groups = useMemo(() => {
    const seen = [...new Set(sorted.map((p) => p.group))];
    return seen.length > 5 ? [...seen.slice(0, 5), 'Other'] : seen;
  }, [sorted]);
  const grp = (p: ScatterPoint) => (groups.includes(p.group) ? p.group : 'Other');
  const data = useMemo<uPlot.AlignedData>(() => {
    const xs = sorted.map((p) => Math.max(p.x, logX ? 1 : 0));
    return [xs, ...groups.map((g) => sorted.map((p) => (grp(p) === g ? Math.max(p.y, logY ? 1 : 0) : null)))] as uPlot.AlignedData;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, groups, logX, logY]);
  const options = useMemo<UPlotOptions>(
    () => ({
      legend: { show: false },
      padding: [8, 12, 0, 0],
      cursor: { points: { size: 10 } },
      hooks: { setCursor: [(u) => { const i = u.cursor.idx; setTip(i == null ? null : sorted[i]?.label ?? null); }] },
      scales: { x: { time: false, distr: logX ? 3 : 1 }, y: { distr: logY ? 3 : 1 } },
      axes: [
        { ...AXIS, label: xLabel, labelFont: '10px IBM Plex Sans, sans-serif', labelSize: 14, values: (_u, v) => v.map(formatX) },
        { ...AXIS, size: 52, label: yLabel, labelFont: '10px IBM Plex Sans, sans-serif', labelSize: 14, values: (_u, v) => v.map(formatY) },
      ],
      series: [
        {},
        ...groups.map((g, i) => ({
          label: g,
          stroke: SERIES[i],
          paths: () => null,
          points: { show: true, size: 8, stroke: '#10131a', width: 2, fill: SERIES[i] },
        })),
      ],
    }),
    [groups, sorted, logX, logY, xLabel, yLabel, formatX, formatY],
  );
  return (
    <div className="flex flex-col gap-2 relative min-w-0">
      {groups.length >= 2 && <Legend names={groups} colors={groups.map((_, i) => SERIES[i])} />}
      <UPlotChart options={options} data={data} height={height} />
      {tip && <div className="absolute right-2 top-7 text-[11px] font-mono bg-bg-3 border border-line-2 rounded-sm px-2 py-1 pointer-events-none">{tip}</div>}
    </div>
  );
}
