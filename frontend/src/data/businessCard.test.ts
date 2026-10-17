import { describe, expect, it } from 'vitest';
import { fillFromCard, type CardFields } from './businessCard';
import { normalizeProfile } from './personProfile';

const F: CardFields = { firstName: 'Dana', lastName: 'Whitfield', name: 'Dana Whitfield', title: 'Project Manager', company: 'Kestrel Electric', email: 'dana@kestrel.com', phone: '(510) 555-0142', mobile: '510 555 0199', fax: '', website: 'kestrel.com', street: '1420 Harbor Blvd', unit: 'Suite 200', city: 'Fremont', state: 'CA', zip: '94538' };
describe('business card -> contact', () => {
  it('fills empty fields and keeps typed ones', () => {
    const r = fillFromCard({ name: '', role: '', company: 'Typed Co', phone: '', email: '' }, normalizeProfile({}), F);
    expect(r.form).toEqual({ name: 'Dana Whitfield', role: 'Project Manager', company: 'Typed Co', phone: '510 555 0199', email: 'dana@kestrel.com' });
    expect(r.profile).toMatchObject({ firstName: 'Dana', lastName: 'Whitfield', contactInfo: { businessPhone: '(510) 555-0142', businessWebsite: 'kestrel.com' } });
    expect(r.profile.addresses.business).toMatchObject({ street: '1420 Harbor Blvd', unit: 'Suite 200', city: 'Fremont', state: 'CA', zip: '94538' });
    expect(r.filled).not.toContain('Company');
  });
  it('a company entry takes the firm as its name and the person as the contact', () => {
    const r = fillFromCard({ name: '', role: '', company: '', phone: '', email: '', contact: '' }, normalizeProfile({}), F, true);
    expect(r.form).toMatchObject({ name: 'Kestrel Electric', contact: 'Dana Whitfield', company: 'Kestrel Electric', role: '' });
  });
});
