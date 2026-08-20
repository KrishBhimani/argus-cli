import { hourWeekday } from './hourWeekday';
import { mk } from './testutil';

it('buckets by local weekday (Mon=0) and hour', () => {
  const m = hourWeekday([mk({ started_at: '2026-08-19T21:24:12' })]); // a Wednesday
  expect(m.length).toBe(7);
  expect(m[0].length).toBe(24);
  expect(m[2][21]).toBe(1);
});
