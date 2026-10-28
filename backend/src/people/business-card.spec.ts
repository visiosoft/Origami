import { parseBusinessCard } from './business-card';

describe('business card reading', () => {
  it('sorts a typical card into fields', () => {
    const f = parseBusinessCard([
      'KESTREL ELECTRIC CO.', 'Dana Whitfield', 'Senior Project Manager',
      '1420 Harbor Blvd, Suite 200', 'Fremont, CA 94538',
      'O: (510) 555-0142', 'M: 510.555.0199', 'F 510-555-0100',
      'dana@kestrelelectric.com', 'www.kestrelelectric.com',
    ].join('\n'));
    expect(f).toMatchObject({
      company: 'KESTREL ELECTRIC CO.', name: 'Dana Whitfield', firstName: 'Dana', lastName: 'Whitfield', title: 'Senior Project Manager',
      street: '1420 Harbor Blvd', unit: 'Suite 200', city: 'Fremont', state: 'CA', zip: '94538',
      phone: '(510) 555-0142', mobile: '510.555.0199', fax: '510-555-0100',
      email: 'dana@kestrelelectric.com', website: 'www.kestrelelectric.com',
    });
  });
  it('falls back to the email domain for the company, and copes with sparse cards', () => {
    const f = parseBusinessCard('Tom Lee\nOwner\ntom@leehomes.com\n415 555 0000');
    expect(f).toMatchObject({ name: 'Tom Lee', title: 'Owner', company: 'Leehomes', phone: '415 555 0000' });
    expect(parseBusinessCard('')).toMatchObject({ name: '', email: '' });
    expect(parseBusinessCard('Jo Park\njo@gmail.com').company).toBe('');
  });
});
