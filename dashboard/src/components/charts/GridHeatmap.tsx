import { rampColor } from './ramp';

export function GridHeatmap({ matrix, rowLabels, colLabels, className = '' }: {
  matrix: number[][]; rowLabels: string[]; colLabels: string[]; className?: string;
}) {
  const max = Math.max(1, ...matrix.flat());
  const cw = 16, ch = 14, gap = 2, lx = 26;
  return (
    <svg className={`block w-full ${className}`} width="100%" viewBox={`0 0 ${lx + colLabels.length * (cw + gap)} ${matrix.length * (ch + gap) + 14}`} style={{ aspectRatio: `${lx + colLabels.length * (cw + gap)} / ${matrix.length * (ch + gap) + 14}` }} role="img" aria-label="Sessions by weekday and hour">
      {rowLabels.map((l, r) => (
        <text key={l} x={0} y={r * (ch + gap) + ch - 3} fontSize={9} fill="#667184" fontFamily="var(--font-mono)">{l}</text>
      ))}
      {colLabels.map((l, c) =>
        c % 3 === 0 ? (
          <text key={l} x={lx + c * (cw + gap)} y={matrix.length * (ch + gap) + 10} fontSize={9} fill="#667184" fontFamily="var(--font-mono)">{l}</text>
        ) : null,
      )}
      {matrix.map((row, r) =>
        row.map((v, c) => (
          <rect key={`${r}-${c}`} x={lx + c * (cw + gap)} y={r * (ch + gap)} width={cw} height={ch} rx={2} fill={rampColor(v, max)}>
            <title>{`${rowLabels[r]} ${colLabels[c]}:00 · ${v}`}</title>
          </rect>
        )),
      )}
    </svg>
  );
}
