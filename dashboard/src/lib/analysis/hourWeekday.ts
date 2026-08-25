import type { Session } from '@/lib/api/client';

// candidate-endpoint: a weekday×hour histogram endpoint would avoid shipping every session.
/** 7×24 matrix (row 0 = Monday), local time; value = count or weight sum. */
export function hourWeekday(sessions: Session[], weight: (s: Session) => number = () => 1): number[][] {
  const m = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const s of sessions) {
    const d = new Date(s.started_at);
    const row = (d.getDay() + 6) % 7;
    m[row][d.getHours()] += weight(s);
  }
  return m;
}
