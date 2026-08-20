import { usd, tok, num, dur, pct, shortDate, shortPath, ago } from './format';

describe('usd', () => {
  it('tiers precision by magnitude (legacy contract)', () => {
    expect(usd(1408.2)).toBe('$1,408');
    expect(usd(203.4)).toBe('$203');
    expect(usd(11.567)).toBe('$11.57');
    expect(usd(3.49)).toBe('$3.49');
    expect(usd(0.0123)).toBe('$0.012');
    expect(usd(0.0012)).toBe('$0.0012');
    expect(usd(null)).toBe('$—');
  });
});

describe('tok', () => {
  it('uses k, M, B with one decimal', () => {
    expect(tok(918_600)).toBe('918.6k');
    expect(tok(1_859_934)).toBe('1.9M');
    expect(tok(1_620_000_000)).toBe('1.62B');
    expect(tok(42)).toBe('42');
  });
});

it('num adds thousands separators', () => expect(num(1859934)).toBe('1,859,934'));

it('dur formats seconds', () => {
  expect(dur(51)).toBe('51s');
  expect(dur(498)).toBe('8m 18s');
  expect(dur(9209)).toBe('2h 33m');
  expect(dur(null)).toBe('—');
});

it('pct', () => {
  expect(pct(0.035)).toBe('3.5%');
  expect(pct(0.8812, 0)).toBe('88%');
});

it('shortDate shows time today, month+day otherwise', () => {
  const now = new Date('2026-08-21T10:00:00');
  expect(shortDate('2026-08-21T02:51:00', now)).toMatch(/02:51|2:51/);
  expect(shortDate('2026-08-19T21:24:00', now)).toBe('Aug 19');
});

it('shortPath keeps the last two segments', () => {
  expect(shortPath('c:/documents/college/xo.builders internship/xo-space/xo-space')).toBe('…/xo-space/xo-space');
  expect(shortPath('short/path')).toBe('short/path');
  expect(shortPath('')).toBe('—');
});

it('ago', () => {
  const now = new Date('2026-08-21T10:00:00Z');
  expect(ago('2026-08-21T09:59:30Z', now)).toBe('just now');
  expect(ago('2026-08-21T07:00:00Z', now)).toBe('3h ago');
});
