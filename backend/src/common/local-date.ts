/**
 * The calendar date (YYYY-MM-DD) in the company's time zone (Nov 17: daily
 * reports and minutes showed the next day -- "today" was taken in UTC, which
 * is already tomorrow on a US evening).
 */
export const DEFAULT_TZ = 'America/Los_Angeles';

export function localToday(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  try {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: tz || DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(now).map((x) => [x.type, x.value]),
    );
    return `${p.year}-${p.month}-${p.day}`;
  } catch {
    return localToday(DEFAULT_TZ, now);
  }
}

/** A YYYY-MM-DD shifted by whole days (calendar maths, no time zone). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday on or before a YYYY-MM-DD. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
}
