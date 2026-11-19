/**
 * Nov 19: meetings come in from the company Google Calendar by themselves.
 * Pure helpers: which calendar events are meetings, what a meeting made from
 * one looks like, and what a sync would create / move / cancel.
 *
 * Before, only the Gemini notes were fetched -- and only for meetings someone
 * had already typed into Origami -- so meetings set up in Google never showed.
 */
import { DEFAULT_TZ } from '../common/local-date';

export interface CalEvent {
  id: string;
  status?: string; // confirmed | tentative | cancelled
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: { email?: string; displayName?: string; self?: boolean; resource?: boolean; responseStatus?: string; organizer?: boolean }[];
  attachments?: { fileUrl?: string; title?: string; mimeType?: string; fileId?: string }[];
}

export interface SyncMeeting { id: string; calendarEventId?: string | null; date: string; time?: string | null; status?: string | null; archivedAt?: string | null; title: string }
export interface SyncUser { id: string; name: string; emails: string[] }
export interface SyncProject { id: number; name: string }

/** Date and HH:mm of an instant in the company's time zone. */
export function localParts(iso: string, tz = DEFAULT_TZ): { date: string; time: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const people = (e: CalEvent) => (e.attendees || []).filter((a) => !a.resource && a.email);

/** A meeting: timed (not all-day), with at least two people, and not one the company account declined. */
export function isMeetingEvent(e: CalEvent): boolean {
  if (!e.start?.dateTime) return false;
  const ppl = people(e);
  if (ppl.length < 2) return false;
  return !ppl.some((a) => a.self && a.responseStatus === 'declined');
}

/** The Gemini notes Doc Google attached to the event, if any. */
export function notesDocOf(e: CalEvent): string | null {
  const a = (e.attachments || []).find((x) => /notes by gemini/i.test(x.title || '') || (x.mimeType === 'application/vnd.google-apps.document' && /gemini/i.test(x.title || '')));
  if (!a) return null;
  return a.fileId || /\/document\/d\/([A-Za-z0-9_-]{20,})/.exec(a.fileUrl || '')?.[1] || null;
}

const norm = (t: string) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The project a meeting's title names -- only when exactly one project matches. */
export function projectFor(title: string, projects: SyncProject[]): SyncProject | null {
  const t = ` ${norm(title)} `;
  const hits = projects.filter((p) => { const n = norm(p.name); return n.length >= 4 && t.includes(` ${n} `); });
  return hits.length === 1 ? hits[0] : null;
}

/** The fields of a meeting made from a calendar event. */
export function meetingFromEvent(e: CalEvent, users: SyncUser[], projects: SyncProject[], companyDomain: string, tz = DEFAULT_TZ) {
  const when = localParts(e.start!.dateTime!, tz)!;
  const byEmail = new Map(users.flatMap((u) => u.emails.map((m) => [m.toLowerCase(), u] as const)));
  const attendees = people(e).map((a) => {
    const email = String(a.email).toLowerCase();
    const u = byEmail.get(email);
    return u ? { id: u.id, name: u.name, email } : { name: a.displayName || email, email };
  });
  const org = String(e.organizer?.email || '').toLowerCase();
  const outside = !!org && !!companyDomain && !org.endsWith('@' + companyDomain) && !byEmail.has(org);
  const project = projectFor(e.summary || '', projects);
  const link = e.hangoutLink || (/^https?:\/\//i.test(e.location || '') ? e.location : '');
  return {
    title: String(e.summary || '').trim() || 'Meeting',
    date: when.date,
    time: when.time,
    type: outside ? 'Outside' : 'Internal',
    organizer: outside ? (e.organizer?.displayName || org) : null,
    locationType: link ? 'virtual' : e.location ? 'in_person' : null,
    location: link || e.location || '',
    attendees,
    agenda: String(e.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n').trim().slice(0, 4000),
    projectId: project?.id ?? null,
    project: project?.name || '',
    status: 'scheduled',
    calendarEventId: e.id,
    sourceType: 'calendar',
  };
}

export interface SyncPlan {
  create: ReturnType<typeof meetingFromEvent>[];
  move: { id: string; title: string; date: string; time: string; from: string }[];
  cancel: { id: string; title: string }[];
  /** Gemini notes Docs attached to events of meetings that have none yet. */
  notes: { id: string; docId: string }[];
  skipped: number;
}

/**
 * What a sync would do. Never brings back a meeting someone archived or
 * deleted (deleted events are in `skips`), and only moves or cancels meetings
 * still planned -- one that happened keeps what the team recorded.
 */
export function planSync(events: CalEvent[], meetings: SyncMeeting[], users: SyncUser[], projects: SyncProject[], skips: Set<string>, companyDomain: string, tz = DEFAULT_TZ): SyncPlan {
  const byEvent = new Map(meetings.filter((m) => m.calendarEventId).map((m) => [m.calendarEventId!, m]));
  const plan: SyncPlan = { create: [], move: [], cancel: [], notes: [], skipped: 0 };
  const planned = (s?: string | null) => ['scheduled', 'rescheduled', '', null, undefined].includes(s as any);
  for (const e of events) {
    const m = byEvent.get(e.id);
    if (skips.has(e.id) || m?.archivedAt) { plan.skipped++; continue; }
    if (e.status === 'cancelled') {
      if (m && planned(m.status)) plan.cancel.push({ id: m.id, title: m.title });
      continue;
    }
    if (!isMeetingEvent(e)) { if (!m) plan.skipped++; continue; }
    const when = localParts(e.start!.dateTime!, tz);
    if (!when) continue;
    if (!m) { plan.create.push(meetingFromEvent(e, users, projects, companyDomain, tz)); continue; }
    if (planned(m.status) && (m.date !== when.date || (m.time || '') !== when.time)) plan.move.push({ id: m.id, title: m.title, date: when.date, time: when.time, from: `${m.date} ${m.time || ''}`.trim() });
    const doc = notesDocOf(e);
    if (doc) plan.notes.push({ id: m.id, docId: doc });
  }
  return plan;
}
