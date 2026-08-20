const COLOR = { info: '#3987e5', warning: '#fab219', critical: '#d03b3b' } as const;

/** Dots on a time axis; radius and colour by severity (the list beside it carries the labels). */
export function AlertStrip({ alerts, days = 30, end = new Date(), className = '' }: {
  alerts: { at: number; severity: keyof typeof COLOR }[]; days?: number; end?: Date; className?: string;
}) {
  const w = 300, h = 36, e = end.getTime(), s = e - days * 86_400_000;
  return (
    <svg className={className} width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Alerts, last ${days} days`}>
      <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="#232934" />
      {alerts
        .filter((a) => a.at >= s && a.at <= e)
        .map((a, i) => (
          <circle key={i} cx={((a.at - s) / (e - s)) * (w - 8) + 4} cy={h / 2} r={a.severity === 'critical' ? 5 : a.severity === 'warning' ? 4 : 3} fill={COLOR[a.severity]} stroke="#10131a" strokeWidth={2}>
            <title>{`${new Date(a.at).toLocaleDateString()} · ${a.severity}`}</title>
          </circle>
        ))}
      <text x={0} y={h - 2} fontSize={9} fill="#667184" fontFamily="var(--font-mono)">{`-${days}d`}</text>
      <text x={w} y={h - 2} fontSize={9} fill="#667184" textAnchor="end" fontFamily="var(--font-mono)">now</text>
    </svg>
  );
}
