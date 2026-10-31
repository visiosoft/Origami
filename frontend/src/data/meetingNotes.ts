/**
 * Meeting notes -> special actions (Oct 26 review notes). Reads notes pasted
 * from Google Meet / Gemini ("quick notes"):
 *
 * - The summary above "Next steps": each heading with bullets under it. Every
 *   bullet becomes its own FOR RECORD item, titled with its heading.
 * - "Next steps": lines like "[Edward Ciccarelli] Prepare Schedule: Prepare
 *   the schedule of values … by Tuesday the 27th." Each becomes a task: the
 *   bracketed names are the assignees (changeable), the text before the colon
 *   is the title, the rest the detail, and a due date is read from the text.
 *   With no date it comes in as High priority until changed.
 *
 * Nothing leaves the browser; the team checks every item before it's added.
 */

export interface NoteRecord { title: string; description: string }
export interface NoteTask { title: string; description: string; names: string[]; dueDate?: string; priority?: 'High' }
export interface ParsedNotes { records: NoteRecord[]; tasks: NoteTask[] }

const BULLET = /^\s*(?:[•●▪◦*\-–]|\d+[.)])\s+/;
const CHECKBOX = /^\s*(?:☐|☑|☒|\[\s?[xX]?\s?\]|[•●*\-–])\s*/;
const isBullet = (l: string) => BULLET.test(l);
const stripBullet = (l: string) => l.replace(BULLET, '').trim();
const NEXT_STEPS = /^\s*(?:#+\s*)?next\s+steps\s*:?\s*$/i;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const atNoon = (ymd: string) => new Date(ymd + 'T12:00:00');

/**
 * A due date read from a next step, relative to the meeting day: "Monday",
 * "Tuesday the 27th", "the 27th", "Oct 30", "10/30", "tomorrow", "next week".
 * Weekdays mean the next one after the meeting. Undefined when there's none.
 */
export function dueFromText(text: string, meetingDate: string): string | undefined {
  const base = atNoon(/^\d{4}-\d{2}-\d{2}$/.test(meetingDate) ? meetingDate : iso(new Date()));
  const t = text.toLowerCase();
  // "Oct 30" / "October 30th"
  const md = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/.exec(t);
  if (md) {
    const m = MONTHS.indexOf(md[1].slice(0, 3));
    const d = new Date(base.getFullYear(), m, Number(md[2]), 12);
    if (d < base) d.setFullYear(d.getFullYear() + 1);
    return iso(d);
  }
  // "10/30"
  const slash = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
  if (slash) {
    const y = slash[3] ? Number(slash[3].length === 2 ? '20' + slash[3] : slash[3]) : base.getFullYear();
    const d = new Date(y, Number(slash[1]) - 1, Number(slash[2]), 12);
    if (!slash[3] && d < base) d.setFullYear(d.getFullYear() + 1);
    return iso(d);
  }
  // "Tuesday the 27th": the 27th wins (it names the exact day).
  const nth = /\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b/.exec(t);
  if (nth) {
    const day = Number(nth[1]);
    const d = new Date(base.getFullYear(), base.getMonth(), day, 12);
    if (d < base) d.setMonth(d.getMonth() + 1);
    return iso(d);
  }
  if (/\btomorrow\b/.test(t)) { const d = new Date(base); d.setDate(d.getDate() + 1); return iso(d); }
  if (/\bnext week\b/.test(t)) { const d = new Date(base); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return iso(d); }
  const wd = new RegExp(`\\b(${WEEKDAYS.join('|')})\\b`).exec(t);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[1]);
    const d = new Date(base);
    d.setDate(d.getDate() + (((target - d.getDay()) + 7) % 7 || 7));
    return iso(d);
  }
  return undefined;
}

/** One next-step line: "[Name, Other] Title: detail". */
export function parseNextStep(line: string, meetingDate: string): NoteTask | null {
  const raw = line.replace(CHECKBOX, '').trim();
  if (!raw) return null;
  const m = /^\[([^\]]+)\]\s*(.*)$/.exec(raw);
  const names = m ? m[1].split(/\s*(?:,|&|\band\b)\s*/).map((n) => n.trim()).filter(Boolean) : [];
  const rest = (m ? m[2] : raw).trim();
  const colon = rest.indexOf(':');
  const title = (colon > 0 && colon <= 80 ? rest.slice(0, colon) : rest.split(/(?<=[.!?])\s/)[0]).trim().replace(/[.:]$/, '');
  const description = (colon > 0 && colon <= 80 ? rest.slice(colon + 1) : rest).trim();
  if (!title) return null;
  const dueDate = dueFromText(description || rest, meetingDate);
  return { title: title.slice(0, 300), description, names, ...(dueDate ? { dueDate } : { priority: 'High' as const }) };
}

export function parseMeetingNotes(text: string, meetingDate: string): ParsedNotes {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const stop = lines.findIndex((l) => NEXT_STEPS.test(l));
  const summary = stop >= 0 ? lines.slice(0, stop) : lines;
  const steps = stop >= 0 ? lines.slice(stop + 1) : [];

  const records: NoteRecord[] = [];
  let heading = '';
  for (let i = 0; i < summary.length; i++) {
    const l = summary[i].trim();
    if (!l) continue;
    if (isBullet(summary[i])) {
      if (heading) records.push({ title: heading, description: stripBullet(summary[i]) });
      continue;
    }
    // A heading is a short plain line with a bullet straight after it (blank lines aside).
    let j = i + 1;
    while (j < summary.length && !summary[j].trim()) j++;
    heading = j < summary.length && isBullet(summary[j]) && l.length <= 120 ? l.replace(/^#+\s*/, '').replace(/:$/, '') : '';
  }

  const tasks = steps.map((l) => parseNextStep(l, meetingDate)).filter((t): t is NoteTask => !!t);
  return { records, tasks };
}

/** Match bracketed names to people: full name, else a unique first name. */
export function matchPeople<T extends { id: string; name: string }>(names: string[], people: T[]): { matched: T[]; unmatched: string[] } {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const matched: T[] = [];
  const unmatched: string[] = [];
  for (const n of names) {
    const full = people.find((p) => norm(p.name) === norm(n));
    const firsts = full ? [] : people.filter((p) => norm(p.name).split(' ')[0] === norm(n).split(' ')[0]);
    const hit = full || (firsts.length === 1 ? firsts[0] : undefined);
    if (hit && !matched.includes(hit)) matched.push(hit); else if (!hit) unmatched.push(n);
  }
  return { matched, unmatched };
}
