import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export type UPlotOptions = Omit<uPlot.Options, 'width' | 'height'>;

/** Owns one uPlot instance: creates on mount, resizes with its container, destroys on unmount. */
export function UPlotChart({ options, data, height = 220 }: { options: UPlotOptions; data: uPlot.AlignedData; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    plot.current = new uPlot({ ...options, width: el.clientWidth || 600, height } as uPlot.Options, data, el);
    const ro = new ResizeObserver(() => plot.current?.setSize({ width: el.clientWidth, height }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      plot.current?.destroy();
      plot.current = null;
    };
  }, [options, data, height]);
  return <div ref={ref} className="w-full min-w-0" />;
}
