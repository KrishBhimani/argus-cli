import { bucketKey, bucketTotals, perSession, perMTokens, cacheShareByBucket, runRate } from './trendsMetrics';
import { mk } from './testutil';

it('bucketKey matches the server: UTC day, month, and Jan-1-anchored week', () => {
  expect(bucketKey('2026-08-21T01:00:00Z', 'day')).toBe('2026-08-21');
  expect(bucketKey('2026-08-21T01:00:00Z', 'month')).toBe('2026-08');
  // 2026-01-01 is a Thursday (jsDow 4): Jan 1–3 → W01, Jan 4 → W02 (same formula as api._week_of).
  expect(bucketKey('2026-01-01T12:00:00Z', 'week')).toBe('2026-W01');
  expect(bucketKey('2026-01-04T12:00:00Z', 'week')).toBe('2026-W02');
  expect(bucketKey('2026-08-21T12:00:00Z', 'week')).toBe('2026-W34');
});

it('bucketTotals, perSession and perMTokens', () => {
  const t = bucketTotals([{ bucket: 'a', groups: { x: { tokens: 2_000_000, cost: 4, sessions: 2 }, y: { tokens: 1_000_000, cost: 1, sessions: 1 } } }]);
  expect(t).toEqual([{ bucket: 'a', tokens: 3_000_000, cost: 5, sessions: 3 }]);
  expect(perSession(t)).toEqual([1_000_000]);
  expect(perMTokens(t)).toEqual([5 / 3]);
});

it('cacheShareByBucket buckets sessions by start time', () => {
  const s = [
    mk({ started_at: '2026-08-20T10:00:00Z', total_cache_read_tokens: 90, total_output_tokens: 10 }),
    mk({ started_at: '2026-08-21T10:00:00Z', total_cache_read_tokens: 0, total_output_tokens: 10 }),
  ];
  expect(cacheShareByBucket(s, ['2026-08-20', '2026-08-21', '2026-08-22'], 'day')).toEqual([0.9, 0, 0]);
});

it('runRate averages the last n complete buckets, ignoring the partial last one', () => {
  expect(runRate([10, 20, 30, 40, 999], 3)).toBe(30);
  expect(runRate([5])).toBeNull();
});
