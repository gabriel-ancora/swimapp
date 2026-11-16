import { describe, expect, it } from 'vitest';
import {
  convertPoolTimeCs,
  formatSwimTime,
  normalizeSwimTime,
  parseSplitsInput,
  parseSwimTime,
} from './time';

describe('parseSwimTime', () => {
  it.each([
    ['50.50', 5050],
    ['50,50', 5050],
    ['50.5', 5050],
    ['50.50s', 5050],
    ['52', 5200],
    [' 1:02.35 ', 6235],
    ['1:02,3', 6230],
    ['1:02', 6200],
    ['16:05.12', 96512],
    ['1:02:03.40', 372340],
  ])('parses %s', (input, expected) => {
    expect(parseSwimTime(input)).toBe(expected);
  });

  it.each(['', 'abc', '1:75.00', '1:61:00', '0', '0.00', '50.505', 'Sub-51s'])(
    'rejects %s',
    (input) => {
      expect(parseSwimTime(input)).toBeNull();
    }
  );
});

describe('formatSwimTime', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatSwimTime(5050)).toBe('50.50');
    expect(formatSwimTime(905)).toBe('9.05');
    expect(formatSwimTime(6235)).toBe('1:02.35');
    expect(formatSwimTime(96512)).toBe('16:05.12');
    expect(formatSwimTime(372340)).toBe('1:02:03.40');
  });

  it('round-trips through parse', () => {
    for (const cs of [2199, 5050, 6000, 12345, 96512]) {
      expect(parseSwimTime(formatSwimTime(cs))).toBe(cs);
    }
  });
});

describe('normalizeSwimTime', () => {
  it('accepts empty input as "not filled"', () => {
    expect(normalizeSwimTime('  ')).toEqual({ ok: true, value: '' });
  });

  it('normalizes valid input and flags invalid input', () => {
    expect(normalizeSwimTime('1:02,3')).toEqual({ ok: true, value: '1:02.30' });
    expect(normalizeSwimTime('52,4s')).toEqual({ ok: true, value: '52.40' });
    expect(normalizeSwimTime('rápido')).toEqual({ ok: false });
  });
});

describe('parseSplitsInput & convertPoolTimeCs', () => {
  it('parses comma or semicolon separated splits', () => {
    expect(parseSplitsInput('25.40, 27.10')).toEqual({ ok: true, splitsCs: [2540, 2710] });
    expect(parseSplitsInput('25,40; 27,10')).toEqual({ ok: true, splitsCs: [2540, 2710] });
    expect(parseSplitsInput('25.40; invalido')).toEqual({ ok: false });
  });

  it('converts between 25m and 50m pools symmetrically', () => {
    const lcm = convertPoolTimeCs(5200, 25, 50, '100m Livre');
    expect(lcm).toBe(5360);
    expect(convertPoolTimeCs(lcm, 50, 25, '100m Livre')).toBe(5200);
  });
});
