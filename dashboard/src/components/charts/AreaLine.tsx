import { useMemo } from 'react';
import type uPlot from 'uplot';
import { UPlotChart, type UPlotOptions } from './UPlotChart';
import { Legend } from './Legend';
import { AXIS, SERIES, hexA } from './uplotTheme';
import { tok } from '@/lib/format/format';

export type LineSeries = { name: string; values: number[] };

/** Category-x line/area chart. `stacked` draws cumulative bands; `share` fixes y to 0–100 %. */
export function AreaLine({ labels, series, stacked = false, fill = true, share = false, format = tok, height = 220 }: {
  labels: string[]; series: LineSeries[]; stacked?: boolean; fill?: boolean; share?: boolean; format?: (n: number) => string; height?: number;
}) {
  const data = useMemo<uPlot.AlignedData>(() => {
    const x = labels.map((_, i) => i);
    if (!stacked) return [x, ...series.map((s) => s.values)];
    const acc = Array<number>(labels.length).fill(0);
    return [x, ...series.map((s) => s.values.map((v, i) => (acc[i] += v)))];
  }, [labels, series, stacked]);
  const options = useMemo<UPlotOptions>(
    () => ({
      cursor: { points: { size: 8 } },
      legend: { show: false },
      padding: [8, 12, 0, 0],
      scales: { x: { time: false }, y: share ? { range: [0, 1] } : {} },
      axes: [
        { ...AXIS, values: (_u, vals) => vals.map((v) => labels[v] ?? '') },
        { ...AXIS, size: 52, values: (_u, vals) => vals.map((v) => (share ? `${Math.round(v * 100)}%` : format(v))) },
      ],
      series: [
        {},
        ...series.map((s, i) => ({
          label: s.name,
          stroke: SERIES[i % SERIES.length],
          width: 2,
          points: { show: false },
          fill: fill ? hexA(SERIES[i % SERIES.length], stacked ? 0.35 : 0.1) : undefined,
          ...(stacked && i > 0 ? { band: true } : {}),
        })),
      ],
    }),
    [labels, series, stacked, fill, share, format],
  );
  return (
    <div className="flex flex-col gap-2 min-w-0">
      {series.length >= 2 && <Legend names={series.map((s) => s.name)} colors={series.map((_, i) => SERIES[i % SERIES.length])} />}
      <UPlotChart options={options} data={data} height={height} />
    </div>
  );
}
