/**
 * Quo call notes → Meetings (Nov 22). When Quo has made its summary of a call
 * (call.summary.completed), the call comes into Origami as a "Call" meeting --
 * held by phone, already happened -- with the summary, next steps and, once
 * Quo sends it, the transcript. Its next steps turn into tasks like any
 * meeting's. Pure helpers, so they can be tested.
 *
 *   POST /webhooks  { url, events: QUO_CALL_EVENTS, label, resourceIds: ['*'] } -> { data: { id, key } }
 *   GET  /calls/{callId}?include=summary   -> { data: { id, direction, participants: [{ phoneNumber, actorId }], createdAt, duration, answeredBy, initiatedBy, actorId, summary: { status, summary[], nextSteps[] } } }
 *   GET  /calls/{callId}/transcripts       -> { data: [{ dialogue: [{ content, identifier, actorId, start, end }] }], nextCursor }
 */
import { localParts } from '../meetings/calendar-sync';

export const QUO_CALL_EVENTS = ['call.summary.completed', 'call.transcript.completed'] as const;
export const QUO_CALL_SOURCE = 'quo-call';

export interface QuoCall {
  id: string; direction?: 'incoming' | 'outgoing' | string; createdAt?: string | null; duration?: number | null;
  participants?: ({ phoneNumber?: string | null; actorId?: string | null } | string)[];
  answeredBy?: string | null; initiatedBy?: string | null; actorId?: string | null;
  summary?: { status?: string | null; summary?: string[] | null; nextSteps?: string[] | null } | null;
}
export interface DialogueLine { content?: string | null; identifier?: string | null; actorId?: string | null; userId?: string | null; start?: number | null }

/** The call id in a delivery: data.resource.callId (summary, transcript) or data.resource.id (call events). */
export function callIdOf(payload: any): string | null {
  const r = payload?.data?.resource || payload?.data?.object || payload?.object || payload?.data || {};
  const id = r.callId || (String(r.id || '').startsWith('AC') ? r.id : null);
  return typeof id === 'string' && id ? id : null;
}

/** The phone numbers on the call that aren't ours (a participant without a Quo user). */
export function otherNumbers(c: QuoCall): string[] {
  return (c.participants || [])
    .map((p) => (typeof p === 'string' ? { phoneNumber: p, actorId: null } : p))
    .filter((p) => p.phoneNumber && !p.actorId)
    .map((p) => String(p.phoneNumber));
}

/** The meeting's notes: the summary, then next steps -- in the layout the notes reader already understands. */
export function callMinutes(summary: string[] | null | undefined, nextSteps: string[] | null | undefined, ourName: string): string {
  const s = (summary || []).map((x) => String(x).trim()).filter(Boolean);
  const n = (nextSteps || []).map((x) => String(x).trim()).filter(Boolean);
  return [
    s.length ? ['Call summary', ...s.map((x) => `- ${x}`)].join('\n') : '',
    n.length ? ['Next steps', ...n.map((x) => (/^\[/.test(x) || !ourName ? `- ${x}` : `- [${ourName}] ${x}`))].join('\n') : '',
    'Summary from Quo’s call notes.',
  ].filter(Boolean).join('\n\n');
}

/** The transcript as "Name: words" lines. */
export function callTranscript(lines: DialogueLine[], nameOf: (l: DialogueLine) => string): string {
  return lines.filter((l) => String(l.content || '').trim()).map((l) => `${nameOf(l) || 'Speaker'}: ${String(l.content).trim()}`).join('\n').slice(0, 200_000);
}

/** The meeting made from a call. */
export function meetingFromCall(c: QuoCall, o: {
  them: { name: string; phone: string; personId?: number | null }; us: { id?: string | null; name: string; email?: string | null } | null;
  project?: { id: number; name: string } | null; minutes: string;
}) {
  const when = localParts(c.createdAt || new Date().toISOString()) || { date: new Date().toISOString().slice(0, 10), time: '' };
  const mins = c.duration ? Math.max(1, Math.round(c.duration / 60)) : null;
  return {
    title: `Call with ${o.them.name || o.them.phone}`.slice(0, 200),
    type: 'Client',
    date: when.date,
    time: when.time,
    locationType: 'call',
    location: `${c.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} Quo call${mins ? ` · ${mins} min` : ''} · ${o.them.phone}`,
    status: 'occurred',
    attendees: [
      ...(o.us ? [{ id: o.us.id || undefined, name: o.us.name, email: o.us.email || undefined }] : []),
      { name: o.them.name || o.them.phone },
    ],
    minutes: o.minutes,
    projectId: o.project?.id ?? null,
    project: o.project?.name || '',
    sourceType: QUO_CALL_SOURCE,
    sourceId: c.id,
    sourceLabel: `Quo call ${o.them.phone}`,
  };
}
