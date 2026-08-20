import type { TrendsResponse } from '@/lib/api/client';
import { trendsToSeries, shareOfTotal, periodDeltas } from './series';

const points: TrendsResponse['points'] = [
  { bucket: '2026-W32', groups: { opus: { tokens: 10, cost: 1, sessions: 1 }, sonnet: { tokens: 5, cost: 0.2, sessions: 1 } } },
  { bucket: '2026-W33', groups: { opus: { tokens: 20, cost: 2, sessions: 1 } } },
];

it('trendsToSeries returns aligned rows with zeros for gaps', () => {
  const s = trendsToSeries(points, 'tokens');
  expect(s.labels).toEqual(['2026-W32', '2026-W33']);
  expect(s.names).toEqual(['opus', 'sonnet']);
  expect(s.rows).toEqual([[10, 20], [5, 0]]);
});

it('folds beyond five names into Other', () => {
  const many = [{ bucket: 'b', groups: Object.fromEntries('abcdefg'.split('').map((k, i) => [k, { tokens: 10 - i, cost: 0, sessions: 0 }])) }];
  const s = trendsToSeries(many, 'tokens');
  expect(s.names).toEqual(['a', 'b', 'c', 'd', 'e', 'Other']);
  expect(s.rows[5]).toEqual([9]);
});

it('shareOfTotal normalises columns', () => expect(shareOfTotal([[1, 0], [3, 0]])).toEqual([[0.25, 0], [0.75, 0]]));

it('periodDeltas', () => expect(periodDeltas([1, 3, 2])).toEqual([null, 2, -1]));
