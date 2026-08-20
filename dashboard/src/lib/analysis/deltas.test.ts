import { delta, deltaTone } from './deltas';

it('delta computes abs/pct/dir', () => {
  expect(delta(120, 100)).toEqual({ abs: 20, pct: 0.2, dir: 'up' });
  expect(delta(100, 100)?.dir).toBe('flat');
  expect(delta(50, 0)?.pct).toBeNull();
  expect(delta(5, null)).toBeNull();
});

it('tone follows direction × whether up is bad', () => {
  expect(deltaTone({ abs: 1, pct: 0.1, dir: 'up' }, true)).toBe('bad');
  expect(deltaTone({ abs: 1, pct: 0.1, dir: 'up' }, false)).toBe('neutral');
  expect(deltaTone({ abs: -1, pct: -0.1, dir: 'down' }, true)).toBe('ok');
});
