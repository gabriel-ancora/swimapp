import { describe, expect, it } from 'vitest';
import { addDaysISO, todayLocalISO, toLocalISODate } from './date';

describe('local dates', () => {
  it('uses the local calendar day, not UTC', () => {
    // 22:30 local time — toISOString() would already be "tomorrow" in UTC-3.
    const lateEvening = new Date(2026, 10, 16, 22, 30);
    expect(todayLocalISO(lateEvening)).toBe('2026-11-16');

    const justAfterMidnight = new Date(2026, 0, 1, 0, 5);
    expect(toLocalISODate(justAfterMidnight)).toBe('2026-01-01');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDaysISO('2026-11-16', 1)).toBe('2026-11-17');
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('returns invalid input unchanged', () => {
    expect(addDaysISO('not-a-date', 3)).toBe('not-a-date');
  });
});
