import { useMemo, useRef, useState } from 'react';
import type uPlot from 'uplot';
import { UPlotChart, type UPlotOptions } from './UPlotChart';
import { Legend } from './Legend';
import { AXIS, SERIES } from './uplotTheme';

const ident = (n: number) => String(n);

export type ScatterPoint = { x: number; y: number; label: string; group: string; detail?: string };

/** One series per group (≤5 + Other), 8 px markers with a surface ring; hover shows the point label. */
export function Scatter({ points, xLabel, yLabel, logX = false, logY = false, formatX = ident, formatY = ident, height = 220, xTicks, yTicks }: {
  points: ScatterPoint[]; xLabel: string; yLabel: string; logX?: boolean; logY?: boolean;
  formatX?: (n: number) => string; formatY?: (n: number) => string; height?: number;
  /** Fixed tick positions (data units); when given, only these are labelled. */
  xTicks?: number[]; yTicks?: number[];
}) {
  const [tip, setTip] = useState<{ p: ScatterPoint; left: number; top: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
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
      hooks: {
        setCursor: [(u) => {
          const i = u.cursor.idx;
          const p = i == null ? null : sorted[i];
          if (!p || u.cursor.left == null || u.cursor.top == null || u.cursor.left < 0) { setTip(null); return; }
          setTip({ p, left: u.cursor.left + u.bbox.left / devicePixelRatio, top: u.cursor.top });
        }],
      },
      scales: { x: { time: false, distr: logX ? 3 : 1 }, y: { distr: logY ? 3 : 1 } },
      axes: [
        { ...AXIS, label: xLabel, labelFont: '10px IBM Plex Sans, sans-serif', labelSize: 14, ...(xTicks ? { splits: (u) => xTicks.filter((t) => t >= u.scales.x.min! && t <= u.scales.x.max!), filter: (_u, sp) => sp } : {}), values: (_u, v) => v.map((x) => (x == null ? '' : formatX(x))) },
        { ...AXIS, size: 52, label: yLabel, labelFont: '10px IBM Plex Sans, sans-serif', labelSize: 14, ...(yTicks ? { splits: (u) => yTicks.filter((t) => t >= u.scales.y.min! && t <= u.scales.y.max!), filter: (_u, sp) => sp } : {}), values: (_u, v) => v.map((x) => (x == null ? '' : formatY(x))) },
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
    [groups, sorted, logX, logY, xLabel, yLabel, formatX, formatY, xTicks, yTicks],
  );
  return (
    <div ref={wrap} className="flex flex-col gap-2 relative min-w-0">
      {groups.length >= 2 && <Legend names={groups} colors={groups.map((_, i) => SERIES[i])} />}
      <UPlotChart options={options} data={data} height={height} />
      {tip && (
        <div
          className="absolute z-10 text-[11px] bg-bg-3 border border-line-2 rounded-md px-2.5 py-1.5 pointer-events-none shadow-lg flex flex-col gap-0.5 whitespace-nowrap"
          style={(() => {
            // Flip to the left of the cursor when the right half of the chart would clip the card.
            const w = wrap.current?.clientWidth ?? 0;
            const flip = w > 0 && tip.left > w * 0.55;
            return flip ? { right: Math.max(0, w - tip.left + 14), top: tip.top + 8 } : { left: tip.left + 14, top: tip.top + 8 };
          })()}
        >
          <span className="font-medium text-ink-0">{tip.p.label}</span>
          {tip.p.detail && <span className="font-mono text-ink-1">{tip.p.detail}</span>}
          <span className="font-mono text-ink-2">{formatX(tip.p.x)} · {formatY(tip.p.y)} · <b className="inline-block w-2 h-2 rounded-[2px] align-middle mr-1" style={{ background: SERIES[Math.min(groups.indexOf(grp(tip.p)), 5)] }} />{tip.p.group}</span>
        </div>
      )}
    </div>
  );
}
