"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMPORT_COLUMNS = void 0;
exports.isoDate = isoDate;
exports.mapHeaders = mapHeaders;
exports.planImport = planImport;
const contact_duplicates_1 = require("./contact-duplicates");
exports.IMPORT_COLUMNS = [
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
const KIND_ALIASES = {
    client: 'Client', owner: 'Client', homeowner: 'Client', customer: 'Client',
    consultant: 'Consultant', architect: 'Consultant', engineer: 'Consultant', designer: 'Consultant',
    sub: 'Sub', subcontractor: 'Sub', contractor: 'Sub', trade: 'Sub',
    vendor: 'Vendor', supplier: 'Vendor',
    authority: 'Authority', city: 'Authority', inspector: 'Authority', agency: 'Authority',
    staff: 'Staff', employee: 'Staff', internal: 'Staff',
};
const COMPANY_KINDS = ['Consultant', 'Sub', 'Vendor', 'Authority'];
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
function isoDate(v) {
    const t = clean(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(t))
        return t;
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t);
    if (!m)
        return '';
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}
function mapHeaders(row) {
    const byNorm = new Map(exports.IMPORT_COLUMNS.map((c) => [norm(c.header), c.key]));
    for (const [alt, key] of [['fullname', 'name'], ['companyname', 'name'], ['type', 'kind'], ['category', 'kind'], ['mobile', 'phone'], ['phonenumber', 'phone'], ['emailaddress', 'email'], ['trade', 'role'], ['title', 'role'], ['address', 'street'], ['zipcode', 'zip'], ['postalcode', 'zip'], ['contact', 'contact'], ['contactperson', 'contact'],
        ['givenname', 'firstName'], ['familyname', 'lastName'], ['organizationname', 'company'], ['organization1name', 'company'], ['organizationtitle', 'role'], ['organization1title', 'role'],
        ['email1value', 'email'], ['phone1value', 'phone'], ['address1street', 'street'], ['address1city', 'city'], ['address1region', 'state'], ['address1postalcode', 'zip'],
        ['mobilephone', 'phone'], ['businessphone', 'phone'], ['primaryphone', 'phone'], ['email1address', 'email'], ['jobtitle', 'role'], ['businessstreet', 'street'], ['businesscity', 'city'], ['businessstate', 'state'], ['businesspostalcode', 'zip'],
    ]) {
        if (!byNorm.has(alt))
            byNorm.set(alt, key);
    }
    const out = {};
    for (const [h, v] of Object.entries(row)) {
        const k = byNorm.get(norm(h));
        if (k && out[k] === undefined)
            out[k] = clean(v);
    }
    return out;
}
function planImport(rows, existing, projectNames, opts) {
    const projectByNorm = new Map(projectNames.map((n) => [n.trim().toLowerCase(), n]));
    const seenEmail = new Set();
    const seenName = new Set();
    return rows.map((raw, i) => {
        const r = mapHeaders(raw);
        const issues = [];
        const kind = KIND_ALIASES[(r.kind || opts.defaultKind || '').toLowerCase()] || '';
        const first = r.firstName || '';
        const last = r.lastName || '';
        let name = r.name || [first, last].filter(Boolean).join(' ');
        if (!r.kind && COMPANY_KINDS.includes(kind) && r.company && name && name.toLowerCase() !== r.company.toLowerCase()) {
            if (!r.contact)
                r.contact = name;
            name = r.company;
        }
        const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email || '') ? r.email.toLowerCase() : '';
        const base = { row: i + 2, name, kind, email };
        if (!Object.values(r).some(Boolean))
            return { ...base, action: 'skip', issues: ['Empty row'] };
        if (!kind)
            return { ...base, action: 'error', issues: [`Kind "${r.kind || ''}" isn't one of Client, Consultant, Sub, Vendor, Authority, Staff`] };
        if (!name)
            return { ...base, action: 'error', issues: ['No name'] };
        if (r.email && !email)
            issues.push(`"${r.email}" isn't an email address — left out`);
        const nameKey = `${kind}|${name.toLowerCase()}`;
        if ((email && seenEmail.has(email)) || (!email && seenName.has(nameKey)))
            return { ...base, action: 'skip', issues: ['Same as an earlier row in this file'] };
        if (email)
            seenEmail.add(email);
        else
            seenName.add(nameKey);
        const projects = [];
        for (const p of (r.projects || '').split(/[;|]/).map((x) => x.trim()).filter(Boolean)) {
            const hit = projectByNorm.get(p.toLowerCase());
            if (hit)
                projects.push(hit);
            else
                issues.push(`No project called "${p}" — left out`);
        }
        const company = COMPANY_KINDS.includes(kind);
        const person = {
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
            if (r.licenseExpires && !exp)
                issues.push(`License expiry "${r.licenseExpires}" isn't a date — left out`);
            person.licenses = [{ id: 'L-' + Math.random().toString(36).slice(2, 9), discipline: 'CSLB', number: r.licenseNumber, licenseType: '', expiresOn: exp, state: r.state || 'CA', notes: '' }];
        }
        if (r.insuranceCarrier || r.insurancePolicy || r.insuranceExpires) {
            const exp = isoDate(r.insuranceExpires || '');
            if (r.insuranceExpires && !exp)
                issues.push(`Insurance expiry "${r.insuranceExpires}" isn't a date — left out`);
            person.insurance = {
                generalLiability: { carrier: r.insuranceCarrier || '', policy: r.insurancePolicy || '', expiresOn: exp, notApplicable: false },
                workersComp: { carrier: '', policy: '', expiresOn: '', notApplicable: false },
            };
        }
        const match = existing.find((p) => email && String(p.email || '').trim().toLowerCase() === email)
            || (!email ? existing.find((p) => p.kind === kind && String(p.name || '').trim().toLowerCase() === name.toLowerCase()) : undefined);
        const alike = !match ? (0, contact_duplicates_1.findDuplicates)({ name, firstName: first, lastName: last, email, phone: r.phone }, existing)[0] : undefined;
        if (alike) {
            const st = alike.contactStatus === 'expired' ? ', expired' : alike.contactStatus === 'review' ? ', in review' : '';
            return { ...base, action: 'skip', matchId: alike.id, issues: [...issues, `Looks like “${alike.name}”${st} — same ${alike.matchedOn.join(' and ')}. Add them by hand if they're someone else`] };
        }
        if (match) {
            if (!opts.update)
                return { ...base, action: 'skip', matchId: match.id, issues: [...issues, `Already in People as “${match.name}” — tick “Update existing” to overwrite`] };
            return { ...base, action: 'update', matchId: match.id, issues, person };
        }
        return { ...base, action: 'create', issues, person };
    });
}
//# sourceMappingURL=people-import.js.map