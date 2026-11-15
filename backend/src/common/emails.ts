/**
 * A person's email addresses (Nov 13 sync): the main one plus any others, e.g.
 * an apogeec.com address and an Origami one. Sign-in, timesheets, employee and
 * People records match on any of them.
 */
export const normEmail = (e: unknown): string => String(e ?? '').trim().toLowerCase();

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Every address on a record, lower-cased, main first, no blanks or repeats. */
export function emailsOf(r: { email?: string | null; altEmails?: string[] | null } | null | undefined): string[] {
  if (!r) return [];
  return [...new Set([normEmail(r.email), ...(Array.isArray(r.altEmails) ? r.altEmails : []).map(normEmail)].filter((e) => e.includes('@')))];
}

/** Do two records share any address? */
export function sharesEmail(a: Parameters<typeof emailsOf>[0], b: Parameters<typeof emailsOf>[0]): boolean {
  const mine = new Set(emailsOf(a));
  return emailsOf(b).some((e) => mine.has(e));
}

/** Clean a typed list of other emails: valid addresses, lower-case, not the main one, no repeats. */
export function cleanAltEmails(list: unknown, main?: string | null): string[] {
  const raw = Array.isArray(list) ? list : String(list ?? '').split(/[\s,;]+/);
  const m = normEmail(main);
  return [...new Set(raw.map(normEmail).filter((e) => e && e !== m && LOOKS_LIKE_EMAIL.test(e)))];
}
