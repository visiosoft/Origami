/**
 * Connections (Oct 27 backlog, Contacts): where someone used to work, so a
 * previous employee who is now at a new company stays connected to both.
 * A person lists their former companies; a company shows its former people.
 */
export interface FormerCompany { company: string; personId?: number | null; role?: string | null; until?: string | null }

/** The list as sent: trimmed, capped, no blanks, one entry per company. */
export function cleanFormer(raw: unknown): FormerCompany[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: FormerCompany[] = [];
  for (const r of raw) {
    const company = String((r as any)?.company || '').trim().slice(0, 200);
    if (!company || seen.has(company.toLowerCase())) continue;
    seen.add(company.toLowerCase());
    const pid = Number((r as any)?.personId);
    out.push({
      company,
      personId: Number.isFinite(pid) && pid > 0 ? pid : null,
      role: String((r as any)?.role || '').trim().slice(0, 120) || null,
      until: String((r as any)?.until || '').trim().slice(0, 20) || null,
    });
  }
  return out.slice(0, 30);
}

/**
 * When an expired record is confirmed as the same person as a current one at
 * another company, the old company goes on the current record's history.
 */
export function formerFromExpired(current: { company?: string | null; formerCompanies?: unknown }, old: { id: number; company?: string | null; role?: string | null; contactStatus?: string | null; contactStatusAt?: string | null }) {
  const list = cleanFormer(current.formerCompanies);
  const oldCompany = String(old.company || '').trim();
  if (old.contactStatus !== 'expired' || !oldCompany || oldCompany.toLowerCase() === String(current.company || '').trim().toLowerCase()) return list;
  return cleanFormer([...list, { company: oldCompany, personId: old.id, role: old.role, until: old.contactStatusAt ? old.contactStatusAt.slice(0, 7) : null }]);
}
