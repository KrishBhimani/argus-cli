import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export type UPlotOptions = Omit<uPlot.Options, 'width' | 'height'>;

/**
 * Owns one uPlot instance. The instance is (re)created only when `options` or `height`
 * change; a new `data` array is pushed with `setData`, which is far cheaper than a
 * teardown + rebuild and is what keeps typing in a filter box smooth.
 */
export function UPlotChart({ options, data, height = 220 }: { options: UPlotOptions; data: uPlot.AlignedData; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    plot.current = new uPlot({ ...options, width: el.clientWidth || 600, height } as uPlot.Options, latest.current, el);
    const ro = new ResizeObserver(() => plot.current?.setSize({ width: el.clientWidth, height }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      plot.current?.destroy();
      plot.current = null;
    };
  }, [options, height]);

  useEffect(() => {
    plot.current?.setData(data);
  }, [data]);

  return <div ref={ref} className="w-full min-w-0" />;
}
