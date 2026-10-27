/**
 * Contacts exported from a phone (iPhone, Android) or Google / Outlook as a
 * vCard (.vcf) file -> rows with the People import's own column headers, so
 * they go through the same preview and duplicate checks as a spreadsheet.
 */
const unescape = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

/** One property line: "TEL;TYPE=CELL:+1 808…" -> { name: 'TEL', params: 'TYPE=CELL', value }. */
function parseLine(line: string) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const [rawName, ...params] = left.split(';');
  const name = rawName.replace(/^item\d+\./i, '').toUpperCase();
  let value = line.slice(colon + 1);
  if (/ENCODING=QUOTED-PRINTABLE/i.test(left)) {
    try { value = decodeURIComponent(value.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, '%$1')); } catch { /* keep as is */ }
  }
  return { name, params: params.join(';').toUpperCase(), value };
}

export function parseVcf(text: string): Record<string, string>[] {
  // Unfold continuation lines (a leading space or tab continues the line above).
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: Record<string, string>[] = [];
  let card: { fn?: string; n?: string[]; org?: string; title?: string; tels: { v: string; p: string }[]; emails: { v: string; p: string }[]; adr?: string[] } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^BEGIN:VCARD$/i.test(line)) { card = { tels: [], emails: [] }; continue; }
    if (/^END:VCARD$/i.test(line)) {
      if (card) {
        const [last = '', first = ''] = (card.n || []).map(unescape);
        const name = unescape(card.fn || '') || [first, last].filter(Boolean).join(' ') || unescape(card.org || '');
        const pick = (list: { v: string; p: string }[], prefer: RegExp) => (list.find((x) => prefer.test(x.p)) || list[0])?.v || '';
        const adr = (card.adr || []).map(unescape);
        const row: Record<string, string> = {
          Name: name, 'First name': first, 'Last name': last, Company: unescape((card.org || '').split(';')[0]), 'Role or trade': unescape(card.title || ''),
          Phone: unescape(pick(card.tels, /CELL|MOBILE|PREF/)), Email: unescape(pick(card.emails, /PREF|WORK/)),
          Street: adr[2] || '', City: adr[3] || '', State: adr[4] || '', ZIP: adr[5] || '',
        };
        if (Object.values(row).some(Boolean)) out.push(row);
      }
      card = null;
      continue;
    }
    if (!card) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'FN') card.fn = p.value;
    else if (p.name === 'N') card.n = p.value.split(';');
    else if (p.name === 'ORG') card.org = p.value;
    else if (p.name === 'TITLE') card.title = p.value;
    else if (p.name === 'TEL') card.tels.push({ v: p.value.replace(/^tel:/i, ''), p: p.params });
    else if (p.name === 'EMAIL') card.emails.push({ v: p.value, p: p.params });
    else if (p.name === 'ADR' && !card.adr) card.adr = p.value.split(';');
  }
  return out;
}
