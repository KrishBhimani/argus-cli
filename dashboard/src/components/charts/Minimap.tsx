import type { TimelineTurn } from '@/lib/api/client';
import { turnAll, turnHasError, turnTokens } from '@/features/session/model';
import { tok } from '@/lib/format/format';

/** Tokens per turn: cache read as the base bar, fresh+output on top; error turns in red. Click to jump. */
export function Minimap({ turns, onPick, active }: { turns: TimelineTurn[]; onPick: (seq: number) => void; active?: number }) {
  const n = Math.max(1, turns.length);
  const W = 1160, H = 96, base = 80;
  const step = (W - 8) / n;
  const bw = Math.max(2, Math.min(46, step - 3));
  const max = Math.max(1, ...turns.map(turnAll));
  const labelEvery = n > 60 ? 10 : 5;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tokens per turn" className="block w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <line x1={0} y1={base} x2={W} y2={base} stroke="#232934" />
      {turns.map((t, i) => {
        const x = 4 + i * step;
        const all = (turnAll(t) / max) * 70;
        const top = (turnTokens(t) / max) * 70;
        const err = turnHasError(t);
        return (
          <g key={t.sequence} data-turn={t.sequence} onClick={() => onPick(t.sequence)} className="cursor-pointer">
            <title>{`#${t.sequence} · ${tok(turnTokens(t))} fresh+output · ${tok(t.cache_read_tokens)} cache read`}</title>
            {active === t.sequence && <rect x={x - 2} y={2} width={bw + 4} height={base - 2} fill="none" stroke="#f0883e" />}
            <rect x={x} y={base - all} width={bw} height={all} fill="#1f3c63" />
            <rect data-kind="top" x={x} y={base - all} width={bw} height={Math.max(2, top)} rx={1} fill={err ? '#d03b3b' : '#3987e5'} />
            {(i % labelEvery === 0 || i === turns.length - 1) && (
              <text x={x + bw / 2} y={H - 2} fontSize={10} textAnchor="middle" fill={err ? '#ff7a7a' : '#667184'} fontFamily="var(--font-mono)">{t.sequence}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
