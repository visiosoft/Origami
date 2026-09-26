import type { PersonEntity } from '../database/entities';

/**
 * The spreadsheet columns for importing People (F8) -- also the template the
 * office downloads. Only Kind and Name are required; any other column may be
 * left out or blank. Header matching ignores case, spaces and punctuation.
 */
export const IMPORT_COLUMNS: { key: string; header: string; hint: string }[] = [
  { key: 'kind', header: 'Kind', hint: 'Client, Consultant, Sub, Vendor, Authority or Staff (required)' },
  { key: 'name', header: 'Name', hint: 'The person — or for a company, the firm name (required)' },
  { key: 'firstName', header: 'First name', hint: 'People only' },
  { key: 'lastName', header: 'Last name', hint: 'People only' },
  { key: 'company', header: 'Company', hint: 'Company shown in lists (defaults to Name for firms)' },
  { key: 'contact', header: 'Primary contact', hint: 'For a firm: the person you actually call' },
  { key: 'role', header: 'Role or trade', hint: 'e.g. Owner, Structural engineer, Electrical' },
  { key: 'phone', header: 'Phone', hint: '' },
  { key: 'email', header: 'Email', hint: 'Used to spot someone already in People' },
  { key: 'projects', header: 'Projects', hint: 'Project names, separated by ;' },
  { key: 'street', header: 'Street', hint: '' },
  { key: 'unit', header: 'Unit', hint: '' },
  { key: 'city', header: 'City', hint: '' },
  { key: 'state', header: 'State', hint: 'e.g. CA' },
  { key: 'zip', header: 'ZIP', hint: '' },
  { key: 'licenseNumber', header: 'License number', hint: 'CSLB or professional license' },
  { key: 'licenseExpires', header: 'License expires', hint: 'YYYY-MM-DD or MM/DD/YYYY' },
  { key: 'insuranceCarrier', header: 'Insurance carrier', hint: 'General liability' },
  { key: 'insurancePolicy', header: 'Insurance policy', hint: '' },
  { key: 'insuranceExpires', header: 'Insurance expires', hint: 'YYYY-MM-DD or MM/DD/YYYY' },
];

const KIND_ALIASES: Record<string, string> = {
  client: 'Client', owner: 'Client', homeowner: 'Client', customer: 'Client',
  consultant: 'Consultant', architect: 'Consultant', engineer: 'Consultant', designer: 'Consultant',
  sub: 'Sub', subcontractor: 'Sub', contractor: 'Sub', trade: 'Sub',
  vendor: 'Vendor', supplier: 'Vendor',
  authority: 'Authority', city: 'Authority', inspector: 'Authority', agency: 'Authority',
  staff: 'Staff', employee: 'Staff', internal: 'Staff',
};
const COMPANY_KINDS = ['Consultant', 'Sub', 'Vendor', 'Authority'];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** "2027-03-31", "3/31/2027" or "03/31/27" -> "2027-03-31"; anything else "". */
export function isoDate(v: string): string {
  const t = clean(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
  if (!m) return '';
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** A spreadsheet row keyed by its own headers -> keyed by our column keys. */
export function mapHeaders(row: Record<string, unknown>): Record<string, string> {
  const byNorm = new Map(IMPORT_COLUMNS.map((c) => [norm(c.header), c.key]));
  // a few common alternative headings
  for (const [alt, key] of [['fullname', 'name'], ['companyname', 'name'], ['type', 'kind'], ['category', 'kind'], ['mobile', 'phone'], ['phonenumber', 'phone'], ['emailaddress', 'email'], ['trade', 'role'], ['title', 'role'], ['address', 'street'], ['zipcode', 'zip'], ['postalcode', 'zip'], ['contact', 'contact'], ['contactperson', 'contact']] as [string, string][]) {
    if (!byNorm.has(alt)) byNorm.set(alt, key);
  }
  const out: Record<string, string> = {};
  for (const [h, v] of Object.entries(row)) { const k = byNorm.get(norm(h)); if (k && out[k] === undefined) out[k] = clean(v); }
  return out;
}

export interface ImportPlanRow {
  row: number;
  action: 'create' | 'update' | 'skip' | 'error';
  name: string; kind: string; email: string;
  matchId?: number;
  issues: string[];
  person?: Record<string, unknown>;
}

/**
 * What an import would do, row by row, before anything is saved: the People
 * record each row becomes, and whether it's new, an update of someone already
 * there (same email, or same kind and name when there's no email), skipped,
 * or unusable. Unknown project names are dropped with a note.
 */
export function planImport(rows: Record<string, unknown>[], existing: Pick<PersonEntity, 'id' | 'name' | 'kind' | 'email'>[], projectNames: string[], opts: { update: boolean }): ImportPlanRow[] {
  const projectByNorm = new Map(projectNames.map((n) => [n.trim().toLowerCase(), n]));
  const seenEmail = new Set<string>();
  const seenName = new Set<string>();
  return rows.map((raw, i) => {
    const r = mapHeaders(raw);
    const issues: string[] = [];
    const kind = KIND_ALIASES[(r.kind || '').toLowerCase()] || '';
    const first = r.firstName || '';
    const last = r.lastName || '';
    const name = r.name || [first, last].filter(Boolean).join(' ');
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email || '') ? r.email!.toLowerCase() : '';
    const base = { row: i + 2, name, kind, email };
    if (!Object.values(r).some(Boolean)) return { ...base, action: 'skip', issues: ['Empty row'] };
    if (!kind) return { ...base, action: 'error', issues: [`Kind "${r.kind || ''}" isn't one of Client, Consultant, Sub, Vendor, Authority, Staff`] };
    if (!name) return { ...base, action: 'error', issues: ['No name'] };
    if (r.email && !email) issues.push(`"${r.email}" isn't an email address — left out`);

    const nameKey = `${kind}|${name.toLowerCase()}`;
    if ((email && seenEmail.has(email)) || (!email && seenName.has(nameKey))) return { ...base, action: 'skip', issues: ['Same as an earlier row in this file'] };
    if (email) seenEmail.add(email); else seenName.add(nameKey);

    const projects: string[] = [];
    for (const p of (r.projects || '').split(/[;|]/).map((x) => x.trim()).filter(Boolean)) {
      const hit = projectByNorm.get(p.toLowerCase());
      if (hit) projects.push(hit); else issues.push(`No project called "${p}" — left out`);
    }
    const company = COMPANY_KINDS.includes(kind);
    const person: Record<string, unknown> = {
      kind, name, tier: kind === 'Staff' ? 'Internal' : kind === 'Client' ? 'Client' : 'Consultant',
      role: r.role || (kind === 'Sub' ? 'Subcontractor' : kind === 'Client' ? 'Client' : ''),
      company: r.company || (company ? name : ''),
      phone: r.phone || '—', email: email || '—',
      categories: [kind === 'Staff' ? 'Internal' : kind],
      ...(r.contact ? { contact: r.contact } : {}),
      ...(first ? { firstName: first } : {}), ...(last ? { lastName: last } : {}),
      ...(projects.length ? { projects } : {}),
    };
    if (r.street || r.city || r.zip) {
      person.addresses = { [company ? 'business' : 'home']: { street: r.street || '', unit: r.unit || '', city: r.city || '', state: r.state || 'CA', zip: r.zip || '', county: '', notApplicable: false } };
    }
    if (r.licenseNumber) {
      const exp = isoDate(r.licenseExpires || '');
      if (r.licenseExpires && !exp) issues.push(`License expiry "${r.licenseExpires}" isn't a date — left out`);
      person.licenses = [{ id: 'L-' + Math.random().toString(36).slice(2, 9), discipline: 'CSLB', number: r.licenseNumber, licenseType: '', expiresOn: exp, state: r.state || 'CA', notes: '' }];
    }
    if (r.insuranceCarrier || r.insurancePolicy || r.insuranceExpires) {
      const exp = isoDate(r.insuranceExpires || '');
      if (r.insuranceExpires && !exp) issues.push(`Insurance expiry "${r.insuranceExpires}" isn't a date — left out`);
      person.insurance = {
        generalLiability: { carrier: r.insuranceCarrier || '', policy: r.insurancePolicy || '', expiresOn: exp, notApplicable: false },
        workersComp: { carrier: '', policy: '', expiresOn: '', notApplicable: false },
      };
    }

    const match = existing.find((p) => email && String(p.email || '').trim().toLowerCase() === email)
      || (!email ? existing.find((p) => p.kind === kind && String(p.name || '').trim().toLowerCase() === name.toLowerCase()) : undefined);
    if (match) {
      if (!opts.update) return { ...base, action: 'skip', matchId: match.id, issues: [...issues, `Already in People as “${match.name}” — tick “Update existing” to overwrite`] };
      return { ...base, action: 'update', matchId: match.id, issues, person };
    }
    return { ...base, action: 'create', issues, person };
  });
}
