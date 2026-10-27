/**
 * Who a site visit invite goes to by default (Oct 27 backlog): each person
 * required or optional. Editable in Settings -> Calendars, and per invite.
 */
export interface TeamMember { name: string; email: string; optional: boolean }

export const SITE_VISIT_TEAM_KEY = 'scheduling.siteVisitTeam';

export const DEFAULT_SITE_VISIT_TEAM: TeamMember[] = [
  { name: 'Edward', email: 'edward@origamidb.com', optional: false },
  { name: 'Langston', email: 'langston@origamidb.com', optional: false },
  { name: 'Astrid', email: 'astrid@origamidb.com', optional: false },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valid emails only, each once (case-insensitive), trimmed. */
export function cleanTeam(list: unknown): TeamMember[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: TeamMember[] = [];
  for (const m of list) {
    const email = String(m?.email || '').trim().toLowerCase();
    if (!EMAIL.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push({ name: String(m?.name || '').trim() || email.split('@')[0], email, optional: !!m?.optional });
  }
  return out;
}

/** The stored team, or the default when nothing was ever saved. */
export function parseTeam(raw: string | null | undefined): TeamMember[] {
  if (!raw) return DEFAULT_SITE_VISIT_TEAM;
  try { return cleanTeam(JSON.parse(raw)); } catch { return DEFAULT_SITE_VISIT_TEAM; }
}

export type Guest = string | { email: string; optional?: boolean; name?: string };

/** Calendar API attendees: a bare email is required; duplicates keep the stricter (required) one. */
export function guestList(list: Guest[] | undefined): { email: string; optional?: boolean; displayName?: string }[] {
  const byEmail = new Map<string, { email: string; optional?: boolean; displayName?: string }>();
  for (const g of list || []) {
    const email = String(typeof g === 'string' ? g : g?.email || '').trim();
    if (!EMAIL.test(email)) continue;
    const key = email.toLowerCase();
    const optional = typeof g === 'object' && !!g.optional;
    const name = typeof g === 'object' ? String(g.name || '').trim() : '';
    const prev = byEmail.get(key);
    if (prev) { if (!optional) delete prev.optional; continue; }
    byEmail.set(key, { email, ...(optional ? { optional: true } : {}), ...(name ? { displayName: name } : {}) });
  }
  return [...byEmail.values()];
}
