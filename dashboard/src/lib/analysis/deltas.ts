export type Delta = { abs: number; pct: number | null; dir: 'up' | 'down' | 'flat' };

export function delta(cur: number, prev: number | null): Delta | null {
  if (prev == null) return null;
  const abs = cur - prev;
  return { abs, pct: prev === 0 ? null : abs / prev, dir: abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat' };
}

/** Colour only when the direction is meaningfully bad/good; otherwise neutral. */
export function deltaTone(d: Delta, upIsBad: boolean): 'bad' | 'ok' | 'neutral' {
  if (d.dir === 'flat' || !upIsBad) return 'neutral';
  return d.dir === 'up' ? 'bad' : 'ok';
}
