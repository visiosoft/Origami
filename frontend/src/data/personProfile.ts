// The People directory's field spec.
//
// One person can belong to several directories at once — a staff member who
// also runs an engineering consultancy is both Internal and a Consultant — so
// categories are a list, and what a record must contain is the union of what
// its categories demand.

export const PERSON_CATEGORIES = [
  'Internal',
  'Client',
  'Consultant',
  'Subcontractor',
  'Vendor / Supplier',
  'City',
] as const;

export type PersonCategory = typeof PERSON_CATEGORIES[number];

/** Required, optional, or not asked for at all. */
export type Need = 'R' | 'O' | '-';

export interface Address {
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  /** Ticked when the address genuinely doesn't apply, so it stops being missing. */
  notApplicable: boolean;
}

export const blankAddress = (): Address => ({
  street: '', unit: '', city: '', state: '', zip: '', county: '', notApplicable: false,
});

export const ADDRESS_KINDS: { key: string; label: string; hint?: string }[] = [
  { key: 'project', label: 'Project Address' },
  { key: 'billing', label: 'Billing Address', hint: 'May be the project or home address, or neither.' },
  { key: 'home', label: 'Home Address' },
  { key: 'business', label: 'Business Address' },
  { key: 'businessMailing', label: 'Business Mailing Address', hint: 'May be the same as the business address.' },
];

/** Business Mailing is the one address that only the first two must hold. */
export const ADDRESS_NEED: Record<string, Partial<Record<PersonCategory, Need>>> = {
  businessMailing: {
    Internal: 'R', Client: 'R', Consultant: 'O', Subcontractor: 'O', 'Vendor / Supplier': 'O', City: 'O',
  },
};

export const addressNeed = (kind: string, categories: string[]): Need => {
  const perCategory = ADDRESS_NEED[kind];
  if (!perCategory) return 'R';
  // The strictest category wins: if any of them requires it, it is required.
  return categories.some((c) => perCategory[c as PersonCategory] === 'R') ? 'R' : 'O';
};

export interface License {
  id: string;
  /** CSLB, Engineer, Architecture, … — see LICENSE_DISCIPLINES. */
  discipline: string;
  number: string;
  licenseType: string;
  expiresOn: string;
  state: string;
  notes: string;
}

export const blankLicense = (discipline = 'CSLB'): License => ({
  id: 'L-' + Math.random().toString(36).slice(2, 9),
  discipline, number: '', licenseType: '', expiresOn: '', state: '', notes: '',
});

/**
 * One repeatable licence record covers every discipline, so somebody holding
 * the same licence in three states is three rows rather than a schema change.
 */
export const LICENSE_DISCIPLINES = [
  'CSLB',
  'Engineer',
  'Architecture',
  'Landscape Architecture',
  'Interior Design',
  'Other Design',
];

export interface Insurance {
  generalLiability: { carrier: string; policy: string; expiresOn: string; notApplicable: boolean };
  workersComp: { carrier: string; policy: string; expiresOn: string; notApplicable: boolean };
}

export const blankInsurance = (): Insurance => ({
  generalLiability: { carrier: '', policy: '', expiresOn: '', notApplicable: false },
  workersComp: { carrier: '', policy: '', expiresOn: '', notApplicable: false },
});

export interface ContactInfo {
  businessPhone: string;
  businessEmail: string;
  businessWebsite: string;
  personalWebsite: string;
  socialMedia: string;
  /** Business phone and email genuinely don't apply to this person. */
  businessNotApplicable: boolean;
}

export const blankContactInfo = (): ContactInfo => ({
  businessPhone: '', businessEmail: '', businessWebsite: '', personalWebsite: '', socialMedia: '',
  businessNotApplicable: false,
});

export interface PersonProfile {
  firstName: string;
  lastName: string;
  goByName: string;
  pronouns: string;
  gender: string;
  categories: string[];
  addresses: Record<string, Address>;
  contactInfo: ContactInfo;
  licenses: License[];
  insurance: Insurance;
  notLicensedDesigner: boolean;
}

export const GENDERS = ['Male', 'Female', 'Unknown'];

/** Identity fields, and whether each has to be filled. */
export const IDENTITY_FIELDS: { key: keyof PersonProfile; label: string; need: Need; ph?: string }[] = [
  { key: 'lastName', label: 'Last Name', need: 'R', ph: 'Family name' },
  { key: 'firstName', label: 'First Name', need: 'R', ph: 'Given name' },
  { key: 'goByName', label: 'Go-By Name', need: 'R', ph: 'What they are called' },
  { key: 'pronouns', label: 'Preferred Pronouns', need: 'O', ph: 'e.g. She / Her' },
];

/** An address counts as answered once it is marked N/A or has a street and city. */
const addressAnswered = (a?: Address) => !!a && (a.notApplicable || (!!a.street.trim() && !!a.city.trim()));

/**
 * What is still missing before this record is complete.
 *
 * Requirements are the union across the person's categories, so adding a
 * category can add requirements but never remove them.
 */
export function missingFields(profile: PersonProfile): string[] {
  const out: string[] = [];
  const cats = profile.categories?.length ? profile.categories : ['Internal'];

  IDENTITY_FIELDS.forEach((f) => {
    if (f.need === 'R' && !String(profile[f.key] ?? '').trim()) out.push(f.label);
  });
  if (!profile.gender?.trim()) out.push('Male / Female / Unknown');

  ADDRESS_KINDS.forEach((a) => {
    if (addressNeed(a.key, cats) !== 'R') return;
    if (!addressAnswered(profile.addresses?.[a.key])) out.push(a.label);
  });

  const c = profile.contactInfo;
  if (!c?.businessNotApplicable && !(c?.businessPhone?.trim() || c?.businessEmail?.trim())) {
    out.push('Business phone or email');
  }

  // Licences are only demanded of someone who is not marked unlicensed —
  // an unlicensed designer has none to give, which is the point of the flag.
  if (!profile.notLicensedDesigner && !(profile.licenses || []).length) {
    out.push('At least one licence');
  }
  (profile.licenses || []).forEach((l, i) => {
    const which = `${l.discipline || 'Licence'} ${i + 1}`;
    if (!l.number.trim()) out.push(`${which} — number`);
    if (!l.expiresOn.trim()) out.push(`${which} — expiry`);
    if (!l.state.trim()) out.push(`${which} — state`);
  });

  const ins = profile.insurance;
  if (!ins?.generalLiability?.notApplicable && !ins?.generalLiability?.expiresOn?.trim()) {
    out.push('General Liability');
  }
  if (!ins?.workersComp?.notApplicable && !ins?.workersComp?.expiresOn?.trim()) {
    out.push('Workers Comp');
  }

  return out;
}

/** A licence within this many days of expiry is worth flagging. */
export const EXPIRY_WARNING_DAYS = 60;

export function expiryState(expiresOn?: string): 'expired' | 'soon' | 'ok' | null {
  if (!expiresOn?.trim()) return null;
  const when = Date.parse(expiresOn);
  if (Number.isNaN(when)) return null;
  const days = (when - Date.now()) / 86400000;
  if (days < 0) return 'expired';
  return days <= EXPIRY_WARNING_DAYS ? 'soon' : 'ok';
}

/** Fill in anything a stored record predates, so the editor never sees undefined. */
export function normalizeProfile(raw: Partial<PersonProfile> & Record<string, any>): PersonProfile {
  const addresses: Record<string, Address> = {};
  ADDRESS_KINDS.forEach((a) => {
    addresses[a.key] = { ...blankAddress(), ...(raw.addresses?.[a.key] || {}) };
  });
  return {
    firstName: raw.firstName || '',
    lastName: raw.lastName || '',
    goByName: raw.goByName || '',
    pronouns: raw.pronouns || '',
    gender: raw.gender || '',
    categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories : [],
    addresses,
    contactInfo: { ...blankContactInfo(), ...(raw.contactInfo || {}) },
    licenses: Array.isArray(raw.licenses) ? raw.licenses.map((l: any) => ({ ...blankLicense(), ...l })) : [],
    insurance: {
      generalLiability: { ...blankInsurance().generalLiability, ...(raw.insurance?.generalLiability || {}) },
      workersComp: { ...blankInsurance().workersComp, ...(raw.insurance?.workersComp || {}) },
    },
    notLicensedDesigner: !!raw.notLicensedDesigner,
  };
}

/** The display name, composed from the parts the form collects. */
export const personDisplayName = (p: { firstName?: string; lastName?: string; goByName?: string; name?: string }) => {
  const composed = [p.firstName, p.lastName].map((x) => (x || '').trim()).filter(Boolean).join(' ');
  return composed || (p.goByName || '').trim() || (p.name || '').trim();
};
