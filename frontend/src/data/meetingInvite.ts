/**
 * Outside meetings (Oct 26 review notes, D1): someone else's invite -- the
 * city on Teams, a consultant's Zoom. Paste the invite and the meeting is
 * filled in from it: the link, the platform, the dial-in, who set it up, the
 * title, the date and time. Everything it finds can still be changed.
 */
export type MeetingPlatform = 'teams' | 'zoom' | 'meet' | 'webex' | 'phone' | 'other';
export const MEETING_PLATFORMS: { key: MeetingPlatform; label: string }[] = [
  { key: 'teams', label: 'Microsoft Teams' },
  { key: 'zoom', label: 'Zoom' },
  { key: 'meet', label: 'Google Meet' },
  { key: 'webex', label: 'Webex' },
  { key: 'phone', label: 'Phone / dial-in' },
  { key: 'other', label: 'Other' },
];
export const platformLabel = (k?: string | null) => MEETING_PLATFORMS.find((p) => p.key === k)?.label || '';

export interface ParsedInvite {
  link?: string; platform?: MeetingPlatform; phone?: string; meetingId?: string; passcode?: string;
  organizer?: string; organizerEmail?: string; organizerOrg?: string; title?: string; date?: string; time?: string;
}

const LINKS: [MeetingPlatform, RegExp][] = [
  ['teams', /https?:\/\/(?:[\w-]+\.)*teams\.(?:microsoft|live)\.com\/[^\s<>"')\]]+/i],
  ['zoom', /https?:\/\/(?:[\w-]+\.)*zoom(?:gov)?\.us\/[^\s<>"')\]]+/i],
  ['meet', /https?:\/\/meet\.google\.com\/[^\s<>"')\]]+/i],
  ['webex', /https?:\/\/(?:[\w-]+\.)*webex\.com\/[^\s<>"')\]]+/i],
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** Free-mail domains say nothing about who the organiser works for. */
const FREE_MAIL = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|aol|proton|protonmail)\./i;
const pad = (n: number) => String(n).padStart(2, '0');
const field = (text: string, names: string) => text.match(new RegExp(`^\\s*(?:${names})\\s*[:：]\\s*(.+)$`, 'im'))?.[1].trim();

/** The first date in a line of text, as yyyy-mm-dd; a missing year is this year (or next, if that's long past). */
export function dateFromText(text: string, today: string): string | undefined {
  const [ty, tm, td] = today.split('-').map(Number);
  const pick = (y: number | undefined, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
    let year = y ?? ty;
    if (y == null && new Date(year, m - 1, d) < new Date(ty, tm - 1, td - 180)) year += 1;
    return `${year}-${pad(m)}-${pad(d)}`;
  };
  const named = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b,?\s*(\d{4})?/i);
  if (named) return pick(named[3] ? Number(named[3]) : undefined, MONTHS.indexOf(named[1].slice(0, 3).toLowerCase()) + 1, Number(named[2]));
  const dayFirst = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s*(\d{4})?/i);
  if (dayFirst) return pick(dayFirst[3] ? Number(dayFirst[3]) : undefined, MONTHS.indexOf(dayFirst[2].slice(0, 3).toLowerCase()) + 1, Number(dayFirst[1]));
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return pick(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (us) return pick(Number(us[3].length === 2 ? '20' + us[3] : us[3]), Number(us[1]), Number(us[2]));
  return undefined;
}

/** The first time in a line of text, as HH:mm (10am, 10:30 AM, 14:00). */
export function timeFromText(text: string): string | undefined {
  // A range ("9:00 – 9:30am") is its start, taking am/pm from the end when the start has none.
  const range = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?m\.?)?\s*[–—-]\s*(\d{1,2})(?::\d{2})?\s*([ap])\.?m\.?/i);
  if (range) {
    const startH = Number(range[1]), endH = Number(range[4]);
    let half = (range[3] || range[5]).toLowerCase();
    if (!range[3] && half === 'p' && startH % 12 > endH % 12) half = 'a';
    return `${pad((startH % 12) + (half === 'p' ? 12 : 0))}:${range[2] || '00'}`;
  }
  const ampm = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3].toLowerCase() === 'p') h += 12;
    return `${pad(h)}:${ampm[2] || '00'}`;
  }
  const h24 = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return h24 ? `${pad(Number(h24[1]))}:${h24[2]}` : undefined;
}

export function parseInvite(raw: string, today: string): ParsedInvite {
  const text = String(raw || '').replace(/\r/g, '');
  const out: ParsedInvite = {};
  for (const [platform, re] of LINKS) {
    const m = text.match(re);
    if (m) { out.link = m[0].replace(/[.,;]+$/, ''); out.platform = platform; break; }
  }
  if (!out.platform && /microsoft teams/i.test(text)) out.platform = 'teams';
  if (!out.platform && /\bzoom\b/i.test(text)) out.platform = 'zoom';

  // A phone number (+1 213-621-0000, (310) 555-0100), not a meeting ID's groups of digits.
  const phone = text.match(/(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b(?:,,[\d#*,]+)?/);
  if (phone) out.phone = phone[0].trim();
  if (!out.platform && out.phone) out.platform = 'phone';
  const id = field(text, 'Meeting ID|Conference ID|Meeting number|Access code');
  if (id) out.meetingId = id.replace(/#$/, '').trim();
  const pass = field(text, 'Passcode|Password|Meeting password');
  if (pass) out.passcode = pass;

  // Who set it up: "Organizer: Jane Doe <jane@city.gov>", or "Jane Doe is inviting you…"
  const org = field(text, 'Organi[sz]er|From|Invited by|Host');
  const inviting = text.match(/^\s*(.+?)\s+(?:is inviting you|has invited you|invited you|is inviting)\b/im)?.[1];
  const who = org || inviting;
  if (who) {
    const email = who.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0];
    const name = who.replace(/<[^>]*>|\([^)]*@[^)]*\)|[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '').replace(/["']/g, '').trim();
    if (name) out.organizer = name;
    if (email) out.organizerEmail = email;
  }
  if (!out.organizerEmail) out.organizerEmail = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0];
  if (!out.organizer && out.organizerEmail) out.organizer = out.organizerEmail;
  const domain = out.organizerEmail?.split('@')[1];
  if (domain && !FREE_MAIL.test(domain)) out.organizerOrg = domain.toLowerCase();

  const title = field(text, 'Topic|Subject|Title|Meeting');
  if (title && !/^https?:/i.test(title)) out.title = title.slice(0, 300);
  const when = field(text, 'When|Time|Date|Start');
  // Without a "When:" line, the first line that reads like a date (Google Calendar: "Tuesday, November 4 · 10:00 – 11:00am").
  const dateLine = when || text.split('\n').find((l) => !/https?:/.test(l) && dateFromText(l, today));
  if (dateLine) {
    out.date = dateFromText(dateLine, today);
    out.time = timeFromText(dateLine);
  }
  if (!out.title) {
    const first = text.split('\n').map((l) => l.trim()).find((l) => l && !/https?:|join|meeting id|passcode|dial|^\+?\d/i.test(l) && l !== dateLine?.trim() && !(inviting && l.includes(inviting)));
    if (first && first.length <= 120) out.title = first;
  }
  return out;
}
