import { blankAddress, type PersonProfile } from './personProfile';

/** What reading a business card gives back (backend people/business-card.ts). */
export interface CardFields {
  firstName: string; lastName: string; name: string; title: string; company: string;
  email: string; phone: string; mobile: string; fax: string; website: string;
  street: string; unit: string; city: string; state: string; zip: string;
}
export interface CardScan { cardToken: string; front: unknown; back: unknown; text: string; fields: CardFields; readError?: string }

/** The quick-form fields a card fills (People -> Add). */
export interface CardForm { name: string; role: string; company: string; phone: string; email: string; contact?: string }

/**
 * Fill a contact from a card -- only the boxes still empty, so nothing already
 * typed is overwritten. Returns the new form and profile, and which fields it filled.
 */
export function fillFromCard<F extends CardForm>(form: F, profile: PersonProfile, f: CardFields, asCompany = false): { form: F; profile: PersonProfile; filled: string[] } {
  const filled: string[] = [];
  const put = <T extends Record<string, any>>(o: T, k: keyof T, v: string, label: string) => {
    if (v && !String(o[k] ?? '').trim()) { (o as any)[k] = v; filled.push(label); }
  };
  const nf = { ...form };
  if (asCompany) {
    // A company entry (consultant, sub, vendor): the firm is the name, the person on the card the primary contact.
    put(nf, 'name', f.company || f.name, 'Company');
    put(nf, 'contact', f.name, 'Primary contact');
    put(nf, 'company', f.company, 'Company shown in lists');
  } else {
    put(nf, 'name', f.name, 'Name');
    put(nf, 'role', f.title, 'Title');
    put(nf, 'company', f.company, 'Company');
  }
  put(nf, 'phone', f.mobile || f.phone, 'Phone');
  put(nf, 'email', f.email, 'Email');
  const np: PersonProfile = { ...profile, contactInfo: { ...profile.contactInfo }, addresses: { ...profile.addresses } };
  // A person's name parts (a company entry's name is the firm, so it keeps none).
  if (!asCompany) {
    put(np, 'firstName', f.firstName, 'First name');
    put(np, 'lastName', f.lastName, 'Last name');
    put(np, 'goByName', f.firstName, 'Go-by name');
  }
  put(np.contactInfo, 'businessPhone', f.phone || f.mobile, 'Business phone');
  put(np.contactInfo, 'businessEmail', f.email, 'Business email');
  put(np.contactInfo, 'businessWebsite', f.website, 'Website');
  const addr = { ...blankAddress(), ...(np.addresses.business || {}) };
  if (f.street && !addr.street.trim()) {
    Object.assign(addr, { street: f.street, unit: addr.unit || f.unit, city: addr.city || f.city, state: addr.state || f.state, zip: addr.zip || f.zip });
    np.addresses.business = addr;
    filled.push('Business address');
  }
  return { form: nf, profile: np, filled };
}
