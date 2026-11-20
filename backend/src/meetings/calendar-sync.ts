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
  iCalUID?: string;
  /** For one occurrence of a repeating event: when it was first due. */
  originalStartTime?: { dateTime?: string; date?: string };
  /** default | outOfOffice | focusTime | workingLocation | birthday | fromGmail */
  eventType?: string;
  /** default | public | private | confidential */
  visibility?: string;
  /** Nov 20: every calendar's id for this event once calendars are merged. */
  ids?: string[];
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

const SPECIAL = new Set(['outOfOffice', 'focusTime', 'workingLocation', 'birthday']);
const isPrivate = (e: CalEvent) => e.visibility === 'private' || e.visibility === 'confidential';

/**
 * A meeting: timed (not all-day), not one of Google's own blocks (out of
 * office, focus time, working location), not marked Private, and not declined
 * by the calendar it came from. Nov 20: all other events count, guests or not.
 */
export function isMeetingEvent(e: CalEvent): boolean {
  if (!e.start?.dateTime) return false;
  if (SPECIAL.has(e.eventType || '') || isPrivate(e)) return false;
  return !people(e).some((a) => a.self && a.responseStatus === 'declined');
}

export interface CalSource { email: string; personal: boolean; events: CalEvent[] }

const idsOf = (e: CalEvent) => e.ids?.length ? e.ids : [e.id];
const keyOf = (e: CalEvent) => `${e.iCalUID || e.id}|${e.originalStartTime?.dateTime || e.originalStartTime?.date || ''}`;
const declinedHere = (e: CalEvent) => people(e).some((a) => a.self && a.responseStatus === 'declined');

/**
 * Nov 20 ("for all people it is showing this email"): the company calendar
 * and everyone's own calendars read together. Copies of one event (the same
 * invite on several calendars) become one, carrying every copy's id. It is
 * cancelled only when its organiser cancelled it or every copy is gone -- one
 * guest removing it from their calendar doesn't cancel it for everyone. A
 * solo event on someone's own calendar gets that person as its attendee.
 */
export function mergeCalendars(sources: CalSource[]): CalEvent[] {
  const groups: { copies: { e: CalEvent; src: CalSource }[] }[] = [];
  const byKey = new Map<string, number>();
  const byId = new Map<string, number>();
  for (const src of sources) {
    for (const e of src.events) {
      const k = keyOf(e);
      let gi = byKey.get(k) ?? byId.get(e.id);
      if (gi === undefined) { gi = groups.length; groups.push({ copies: [] }); }
      groups[gi].copies.push({ e, src });
      byKey.set(k, gi); byId.set(e.id, gi);
    }
  }
  return groups.map(({ copies }) => {
    const ids = [...new Set(copies.map((c) => c.e.id))];
    const live = copies.filter((c) => c.e.status !== 'cancelled');
    const organiserCancelled = copies.some((c) => c.e.status === 'cancelled' && c.e.organizer?.self);
    if (!live.length || organiserCancelled) return { ...copies[0].e, status: 'cancelled', ids };
    const attending = live.filter((c) => !declinedHere(c.e));
    const pick = (attending.length ? attending : live);
    const best = pick.find((c) => c.e.organizer?.self) || pick.find((c) => notesDocOf(c.e)) || pick[0];
    const e: CalEvent = { ...best.e, ids };
    if (!e.attachments?.length) e.attachments = live.flatMap((c) => c.e.attachments || []);
    if (live.some((c) => isPrivate(c.e))) e.visibility = 'private';
    if (!people(e).length && best.src.personal) e.attendees = [{ email: best.src.email, self: true, responseStatus: 'accepted' }];
    return e;
  });
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
    const ids = idsOf(e);
    const m = ids.map((id) => byEvent.get(id)).find(Boolean);
    if (ids.some((id) => skips.has(id)) || m?.archivedAt) { plan.skipped++; continue; }
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
