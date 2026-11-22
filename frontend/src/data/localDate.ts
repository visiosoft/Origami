/**
 * Calendar dates in the viewer's own time zone (Nov 17: reports showed the
 * next day -- `toISOString()` gives the UTC date, already tomorrow on a US
 * evening).
 */
export const localISO = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayISO = (): string => localISO(new Date());

/** The Monday of the week holding this date (local). */
export const weekStartISO = (d: Date = new Date()): string => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return localISO(x);
};
