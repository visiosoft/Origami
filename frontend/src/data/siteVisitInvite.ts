/**
 * The site visit invite (Oct 27 backlog): who's on it, each required or
 * optional, and a description carrying the scope -- plus, when asked, the
 * lead's Zoning Analysis. Pure, so it's tested without a calendar.
 */
export interface Guest { name: string; email: string; optional: boolean }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s: string) => EMAIL.test(s.trim());

/** The lead first (required), then the team; each email once. */
export function inviteGuests(team: Guest[], client?: { name?: string; email?: string }): Guest[] {
  const out: Guest[] = [];
  const add = (g: Guest) => {
    const email = g.email.trim();
    if (isEmail(email) && !out.some((o) => o.email.toLowerCase() === email.toLowerCase())) out.push({ ...g, email });
  };
  if (client?.email) add({ name: client.name || 'Client', email: client.email, optional: false });
  team.forEach(add);
  return out;
}

/** The lead fields that say what the job is, in the order the invite lists them. */
export const SCOPE_FIELDS: [label: string, key: string][] = [
  ['Project type', 'potentialProjectType'],
  ['Property type', 'propertyType'],
  ['Occupancy', 'occupancyStatus'],
  ['HOA', 'hasHOA'],
  ['Vision', 'projectVision'],
  ['Why now', 'reasonForProject'],
  ['Budget', 'budgetPosition'],
  ['Funding', 'fundingStatus'],
  ['Desired start', 'desiredStart'],
  ['Expected duration', 'expectedDuration'],
];

const answered = (v: unknown): string => {
  const t = Array.isArray(v) ? v.join(', ') : String(v ?? '').trim();
  return /^(n\/?a|none|-+|—)?$/i.test(t) ? '' : t;
};

type ZoningForm = { title: string; fields: { key?: string; label: string; heading?: boolean }[] }[];

/** The filled-in Zoning Analysis fields, by section; empty sections left out. */
export function zoningSections(form: ZoningForm, values: Record<string, string>): { title: string; rows: [string, string][] }[] {
  return form
    .map((sec) => ({ title: sec.title, rows: sec.fields.filter((f) => f.key && answered(values[f.key])).map((f) => [f.label, answered(values[f.key!])] as [string, string]) }))
    .filter((s) => s.rows.length);
}

export function siteVisitDescription(o: {
  lead: Record<string, unknown>;
  leadName: string;
  address?: string;
  phone?: string;
  notes?: string;
  zoning?: { title: string; rows: [string, string][] }[];
  link?: string;
}): string {
  const lines: string[] = [`On-site visit — ${o.leadName}`];
  if (o.address) lines.push(`Site: ${o.address}`);
  if (o.phone) lines.push(`Client phone: ${o.phone}`);
  const scope = SCOPE_FIELDS.map(([label, key]) => [label, answered(o.lead[key])]).filter(([, v]) => v);
  if (scope.length) lines.push('', 'SCOPE', ...scope.map(([l, v]) => `• ${l}: ${v}`));
  if (o.notes?.trim()) lines.push('', 'PRELIMINARY INFO', o.notes.trim());
  if (o.zoning?.length) {
    lines.push('', 'ZONING ANALYSIS');
    for (const s of o.zoning) lines.push(`${s.title}:`, ...s.rows.map(([l, v]) => `• ${l}: ${v}`));
  }
  if (o.link) lines.push('', `Open the lead in Origami: ${o.link}`);
  return lines.join('\n');
}
