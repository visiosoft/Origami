/**
 * Read a business card: the text Google's OCR found on the photo(s), sorted
 * into contact fields. A best guess -- the person reviews and corrects it
 * before saving, and the photos are kept on the contact either way.
 */
export interface CardFields {
  firstName: string; lastName: string; name: string; title: string; company: string;
  email: string; phone: string; mobile: string; fax: string; website: string;
  street: string; unit: string; city: string; state: string; zip: string;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const WEB = /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|co|us|io|biz|info|build|design|construction|ae|uk|ca)(?:\/[^\s]*)?)\b/i;
const PHONE = /(\+?1?[\s.-]*\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?)/i;
const CITY_LINE = /^(.+?),?\s+([A-Z]{2})\.?,?\s+(\d{5}(?:-\d{4})?)$/;
const STREET = /^\d+[A-Z]?\s+\S.*\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|way|ln|lane|ct|court|pl|place|pkwy|parkway|hwy|highway|cir|circle|ter|terrace|sq|square|loop|trl|trail)\b\.?/i;
const UNIT = /,?\s*((?:suite|ste\.?|unit|#|apt\.?|floor|fl\.?)\s*[\w-]+)\s*$/i;
const TITLE_WORDS = /\b(president|vice|vp|ceo|cfo|coo|cto|owner|founder|principal|partner|director|manager|engineer|architect|designer|estimator|superintendent|foreman|coordinator|consultant|associate|sales|representative|rep|specialist|officer|administrator|supervisor|inspector|agent|broker|advisor|project|lead|head|executive|accountant|planner|surveyor|technician|electrician|plumber|contractor)\b/i;
const COMPANY_WORDS = /\b(inc|llc|l\.l\.c|ltd|corp|corporation|co\.?|company|group|builders?|construction|contracting|contractors?|design|architects?|architecture|engineering|electric(al)?|plumbing|roofing|associates|partners|studio|services|supply|homes|development|properties|realty|solutions|systems|enterprises|industries)\b/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const digits = (s: string) => s.replace(/[^\d]/g, '');

export function parseBusinessCard(text: string): CardFields {
  const out: CardFields = { firstName: '', lastName: '', name: '', title: '', company: '', email: '', phone: '', mobile: '', fax: '', website: '', street: '', unit: '', city: '', state: '', zip: '' };
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(clean).filter(Boolean);
  const used = new Set<number>();

  lines.forEach((line, i) => {
    const email = EMAIL.exec(line);
    if (email && !out.email) { out.email = email[0].toLowerCase(); used.add(i); }
    // Phones: the label decides which (M / Cell -> mobile, F / Fax -> fax, anything else -> phone).
    let rest = line;
    let m: RegExpExecArray | null;
    while ((m = PHONE.exec(rest))) {
      const before = rest.slice(0, m.index).toLowerCase();
      const num = clean(m[1]);
      if (digits(num).length >= 10) {
        if (/\b(f|fax)\b\W*$/.test(before)) out.fax ||= num;
        else if (/\b(m|c|cell|mobile|mob)\b\W*$/.test(before)) out.mobile ||= num;
        else if (!out.phone) out.phone = num;
        else out.mobile ||= num;
        used.add(i);
      }
      rest = rest.slice(m.index + m[0].length);
    }
    if (!used.has(i) || !out.website) {
      const web = WEB.exec(line.replace(EMAIL, ''));
      if (web && !out.website && !/@/.test(web[1])) { out.website = web[1].replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase(); if (clean(line.replace(web[0], '')).length < 4) used.add(i); }
    }
  });

  // Address: a street line, and a "City, ST 12345" line (often the next one).
  lines.forEach((line, i) => {
    if (used.has(i)) return;
    const city = CITY_LINE.exec(line);
    if (city && !out.city) {
      const before = city[1];
      // "123 Main St, Springfield, IL 62701" on one line.
      const parts = before.split(',').map(clean);
      if (parts.length > 1 && STREET.test(parts[0])) { out.street = parts[0]; out.city = parts[parts.length - 1]; }
      else out.city = before.replace(/,$/, '');
      out.state = city[2]; out.zip = city[3];
      used.add(i);
    } else if (STREET.test(line) && !out.street) {
      const u = UNIT.exec(line);
      out.street = u ? clean(line.slice(0, u.index)).replace(/,$/, '') : line;
      if (u) out.unit = u[1];
      used.add(i);
    }
  });
  if (out.street && !out.unit) { const u = UNIT.exec(out.street); if (u) { out.unit = u[1]; out.street = clean(out.street.slice(0, u.index)).replace(/,$/, ''); } }

  const free = lines.map((l, i) => ({ l, i })).filter(({ l, i }) => !used.has(i) && !/\d{3,}/.test(l) && l.length > 1);
  const title = free.find(({ l }) => TITLE_WORDS.test(l) && !COMPANY_WORDS.test(l));
  if (title) { out.title = title.l; used.add(title.i); }
  const company = free.find(({ l, i }) => !used.has(i) && COMPANY_WORDS.test(l));
  if (company) { out.company = company.l; used.add(company.i); }
  // The name: a short line of 2-4 words, letters only, preferably Capitalised.
  const nameLine = free.find(({ l, i }) => !used.has(i) && /^[A-Za-z][A-Za-z.'\- ]+$/.test(l) && l.split(' ').length >= 2 && l.split(' ').length <= 4)
    || free.find(({ i }) => !used.has(i));
  if (nameLine) {
    used.add(nameLine.i);
    out.name = nameLine.l.replace(/,.*$/, '');
    const words = out.name.split(' ').filter((w) => !/^(mr|mrs|ms|dr)\.?$/i.test(w));
    out.firstName = words[0] || '';
    out.lastName = words.length > 1 ? words[words.length - 1] : '';
  }
  // No company line: the email's or website's domain is the best hint.
  if (!out.company) {
    const domain = (out.email.split('@')[1] || out.website).split('.')[0];
    if (domain && !/^(gmail|yahoo|hotmail|outlook|icloud|aol|live|msn|me)$/i.test(domain)) out.company = domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return out;
}
