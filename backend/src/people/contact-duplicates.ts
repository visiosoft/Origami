/**
 * Possible duplicates of a contact being added (Oct 27 backlog, Contacts): the
 * same name, email or phone as someone already in People -- Expired contacts
 * included, so an old record isn't silently recreated.
 */
export interface DupCandidate { name?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }
export interface DupRow extends DupCandidate { id: number; company?: string | null; kind?: string | null; contactStatus?: string | null; contactStatusReason?: string | null; lastActivityAt?: string | null }
export type MatchedOn = 'name' | 'email' | 'phone';

/** "Dr. Kai  Lono-Smith" -> "kai lono smith". */
export const normName = (v?: string | null) => String(v || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(mr|mrs|ms|dr|jr|sr)\b\.?/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
/** The last 10 digits, so "+1 (808) 555-0101" and "808.555.0101" match; '' for anything shorter than 7. */
export const normPhone = (v?: string | null) => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 7 ? d.slice(-10) : ''; };
export const normEmail = (v?: string | null) => String(v || '').trim().toLowerCase();
const fullName = (p: DupCandidate) => normName([p.firstName, p.lastName].filter(Boolean).join(' ')) || normName(p.name);

/** Everyone who shares a name (2+ words), email or phone with the candidate, Expired first. */
export function findDuplicates(c: DupCandidate, rows: DupRow[], excludeId?: number | null): (DupRow & { matchedOn: MatchedOn[] })[] {
  const name = fullName(c);
  const email = normEmail(c.email);
  const phone = normPhone(c.phone);
  const out: (DupRow & { matchedOn: MatchedOn[] })[] = [];
  for (const r of rows) {
    if (excludeId != null && r.id === excludeId) continue;
    const on: MatchedOn[] = [];
    if (name.includes(' ') && fullName(r) === name) on.push('name');
    if (email && normEmail(r.email) === email) on.push('email');
    if (phone && normPhone(r.phone) === phone) on.push('phone');
    if (on.length) out.push({ ...r, matchedOn: on });
  }
  const expired = (r: DupRow) => (r.contactStatus === 'expired' ? 0 : 1);
  return out.sort((a, b) => expired(a) - expired(b) || b.matchedOn.length - a.matchedOn.length);
}

/** Add `other` to a record's "same person" links (no repeats, never itself). */
export const withLink = (ids: unknown, other: number, self: number) => {
  const list = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isFinite(n)) : [];
  return other === self || list.includes(other) ? list : [...list, other];
};
export const withoutLink = (ids: unknown, other: number) => (Array.isArray(ids) ? ids.map(Number).filter((n) => n !== other) : []);
