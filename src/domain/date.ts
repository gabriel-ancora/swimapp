/**
 * Date helpers that work on the user's local calendar day.
 *
 * `Date.prototype.toISOString()` is always UTC, so slicing it gives the wrong
 * day near midnight (in Brazil, after 21h it already returns "tomorrow").
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Formats a Date as `YYYY-MM-DD` using its local calendar fields. */
export function toLocalISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today's local date as `YYYY-MM-DD`. */
export function todayLocalISO(now: Date = new Date()): string {
  return toLocalISODate(now);
}

/** Adds (or subtracts) whole days to a `YYYY-MM-DD` string, staying on local dates. */
export function addDaysISO(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + days);
  return toLocalISODate(base);
}
