/**
 * Meeting notes from Google (Nov 3 sync): Gemini writes "<title> - <yyyy/mm/dd
 * HH:mm TZ> - Notes by Gemini" into the organiser's Drive. Pure helpers for
 * finding it and splitting it into the notes and the transcript.
 */

/** A Doc id from a link or a bare id. */
export function docIdFrom(link: string): string | null {
  const s = String(link || '').trim();
  const m = /\/document\/d\/([A-Za-z0-9_-]{20,})/.exec(s) || /[?&]id=([A-Za-z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : null;
}

/** The Drive query for a meeting's notes: its title, its date as Gemini writes it, and "Notes by Gemini". */
export function notesQuery(title: string, date: string): string {
  const q = (v: string) => v.replace(/['\\]/g, '\\$&');
  const words = String(title || '').replace(/[^\p{L}\p{N}\s+&-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  const parts = [`name contains 'Notes by Gemini'`];
  if (words) parts.push(`name contains '${q(words)}'`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) parts.push(`name contains '${date.replace(/-/g, '/')}'`);
  return parts.join(' and ');
}

/** Split Gemini's Doc: the notes (summary, decisions, next steps, details) and the transcript after it. */
export function splitGeminiDoc(text: string): { notes: string; transcript: string } {
  const t = String(text || '').replace(/\r\n/g, '\n');
  const at = t.search(/^.*-\s*Transcript\s*$/m);
  const notes = (at >= 0 ? t.slice(0, at) : t)
    // Gemini's own prompts and footers aren't part of the notes.
    .split('\n').filter((l) => !/^(Please rate|You should review Gemini|Want to see more|How is the quality|Get tips and learn|Take a short survey)/i.test(l.trim()))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { notes, transcript: at >= 0 ? t.slice(at).trim() : '' };
}

/** Has this meeting ended (date + time, or the whole day) more than `minutes` ago? */
export function endedBefore(date: string, time: string | null | undefined, now: Date, minutes = 30): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const start = new Date(`${date}T${/^\d{2}:\d{2}/.test(time || '') ? time!.slice(0, 5) : '23:59'}:00`);
  return now.getTime() - start.getTime() > (60 + minutes) * 60_000;
}

/**
 * A Gemini notes Doc's name -> the meeting it belongs to:
 * "Weekly Sync - Ehsan / Origami DB - 2026/11/03 10:00 PST - Notes by Gemini"
 * gives { title: "Weekly Sync - Ehsan / Origami DB", date: "2026-11-03", time: "10:00" }.
 */
export function parseNotesDocName(name: string): { title: string; date: string | null; time: string | null } {
  const n = String(name || '').replace(/\s*-\s*Notes by Gemini\s*$/i, '').trim();
  const m = n.match(/^(.*?)\s*-\s*(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{1,2}):(\d{2}))?(?:\s+[A-Z]{2,5})?\s*$/);
  if (!m) return { title: n || 'Meeting', date: null, time: null };
  return { title: m[1].trim() || 'Meeting', date: `${m[2]}-${m[3]}-${m[4]}`, time: m[5] ? `${m[5].padStart(2, '0')}:${m[6]}` : null };
}

/** Same meeting? Same date, and one title contains the other once punctuation and case are set aside. */
export function sameMeeting(a: { title?: string | null; date?: string | null }, b: { title: string; date: string | null }): boolean {
  if (!b.date || a.date !== b.date) return false;
  const norm = (t: string) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const x = norm(a.title || ''); const y = norm(b.title);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/**
 * Nov 19 (Edward): the date a meeting's notes or transcript say it was held --
 * "Meeting Date: November 12, 2026", or a Gemini / Fathom header like
 * "… Weekly Sync - 2026/11/12 13:58 PST - Transcript". Null when none.
 */
export function dateInNotes(text: string | null | undefined): string | null {
  const t = String(text || '').slice(0, 4000);
  const iso = (y: number, m: number, d: number) => (y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);
  const labelled = /\b(?:meeting\s+)?date\s*[:-]\s*(?:[a-z]+,?\s+)?([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(t);
  if (labelled) { const m = MONTHS.findIndex((x) => x.startsWith(labelled[1].toLowerCase().slice(0, 3))); const r = m >= 0 ? iso(+labelled[3], m + 1, +labelled[2]) : null; if (r) return r; }
  const slash = /\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/.exec(t);
  if (slash) return iso(+slash[1], +slash[2], +slash[3]);
  const words = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})\b/i.exec(t);
  if (words) return iso(+words[3], MONTHS.indexOf(words[1].toLowerCase()) + 1, +words[2]);
  return null;
}
