import { windowDays, dayKeys, sliceWindow, priorWindowTotal, widerWindowFor } from './windows';

const today = new Date('2026-08-21T12:00:00');

it('windowDays', () => {
  expect(windowDays('24h')).toBe(1);
  expect(windowDays('7d')).toBe(7);
  expect(windowDays('all')).toBeNull();
});

it('dayKeys ends at the given day', () => expect(dayKeys(today, 3)).toEqual(['2026-08-19', '2026-08-20', '2026-08-21']));

it('priorWindowTotal sums the n days before the current n', () => {
  const byDay = { '2026-08-21': 5, '2026-08-20': 5, '2026-08-19': 1, '2026-08-18': 1, '2026-08-17': 100 };
  expect(sliceWindow(byDay, dayKeys(today, 2))).toBe(10);
  expect(priorWindowTotal(byDay, '24h', today)).toBe(5);
  expect(priorWindowTotal(byDay, 'all', today)).toBeNull();
  expect(widerWindowFor('7d')).toBe('30d');
});
