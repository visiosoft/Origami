import { breakable, buildLetterHtml, footerBarHtml, type Branding } from './letterhead';

/** Nov 20 Weekly Sync: letters looked "distorted or messy" when names, emails and addresses ran 10–100 characters. */
describe('letterhead with long values', () => {
  const brand = {
    companyName: 'Origami Design + Build — Residential and Commercial Construction Services Inc.',
    tagline: 'DESIGN · BUILD', accentColor: '#C8A24A',
    address: '1311 Countryside Court, Building B, Suite 200, Milpitas, California 95035-1234',
    phone: '(408) 555-0100', email: 'introductions.and.new.clients@origamidesignbuild.example.com', website: 'https://www.origamidesignbuild.example.com/residential',
  } as unknown as Branding;
  const longestRun = (html: string) => Math.max(...html.replace(/<[^>]+>/g, ' ').replace(/&#8203;/g, ' ').replace(/&[a-z]+;/g, ' ').split(/\s+/).map((w) => w.length));

  it('leaves short values exactly as typed', () => {
    expect(breakable('Raffie Karabed')).toBe('Raffie Karabed');
    expect(breakable('a@b.co')).toBe('a@b.co');
  });

  it('puts break points in long emails and links', () => {
    const out = breakable('introductions.and.new.clients@origamidesignbuild.example.com');
    expect(out.replace(/&#8203;/g, '')).toBe('introductions.and.new.clients@origamidesignbuild.example.com');
    expect(longestRun(out)).toBeLessThanOrEqual(24);
  });

  it('a letter with 100-character values has nothing that can’t wrap, a smaller company name, and fixed columns', () => {
    const html = buildLetterHtml({
      brand, title: 'Welcome', docTitle: 'Introduction Letter', includeCoverPage: true, date: 'November 20, 2026',
      recipient: 'Mr. and Mrs. Bartholomew-Fitzgerald Montgomery-Castellanos of the Countryside Court Homeowners', contactEmail: 'bartholomew.fitzgerald.montgomery@countrysidecourthomeowners.example.org',
      body: 'Thank you.',
    });
    expect(longestRun(html.replace(/data:[^"]+/g, ''))).toBeLessThanOrEqual(40);
    expect(html).toContain('font-size:13pt;font-weight:bold');
    expect(html).toContain('width="70"');
  });

  it('a long footer goes on two lines', () => {
    expect(footerBarHtml(brand)).toMatch(/95035-1234<br\/>/);
    expect(footerBarHtml({ ...brand, address: 'Milpitas', email: 'a@b.co', website: '' } as Branding)).not.toContain('<br/>');
  });
});
