export function Sparkline({ values, width = 120, height = 28, className = '' }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (width - 4) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [2 + i * step, height - 2 - (v / max) * (height - 4)] as const);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke="#3987e5" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="#3987e5" stroke="#10131a" strokeWidth={2} />
    </svg>
  );
}
