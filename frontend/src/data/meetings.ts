/** A meeting and what came out of it; see the backend MeetingEntity and meetings/meeting-status.ts. */
export interface Attendee { id?: string; name: string; email?: string }

/**
 * scheduled → occurred (not yet gone through) → reviewed (special actions and
 * FOR RECORD items pulled out) → complete (set by the server once everything
 * captured is done). Cancelled and rescheduled sit beside them.
 */
export type MeetingStatus = 'scheduled' | 'occurred' | 'cancelled' | 'rescheduled' | 'reviewed' | 'complete';
export type MeetingLocationType = 'virtual' | 'call' | 'text' | 'in_person';

export interface Meeting {
  id: string; title: string; type: string; projectId?: number | null; project?: string; date: string; time?: string;
  /** The address (in person) or the link / dial-in. */
  location?: string;
  locationType?: MeetingLocationType | null;
  attendees?: Attendee[] | null; agenda?: string; minutes?: string; status: MeetingStatus; rfiIds?: string[] | null;
  changeOrderIds?: string[] | null;
  recordingUrl?: string; transcriptUrl?: string; transcript?: string;
  reviewedBy?: string; reviewedAt?: string;
  createdBy?: string; createdAt?: string; updatedAt?: string;
}
export const MEETING_TYPES = ['Internal', 'Client', 'Consultant', 'Subcontractor', 'Site'];
export const MEETING_FIELDS: (keyof Meeting)[] = ['title', 'type', 'projectId', 'project', 'date', 'time', 'location', 'locationType', 'attendees', 'agenda', 'minutes', 'status', 'rfiIds', 'changeOrderIds', 'recordingUrl', 'transcriptUrl', 'transcript'];

type Tone = 'yellow' | 'soft' | 'outline' | 'dark' | 'green' | 'warn';
/** Label, pill tone and what it means -- in the order they're offered. */
export const MEETING_STATUSES: { key: MeetingStatus; label: string; tone: Tone; hint: string }[] = [
  { key: 'scheduled', label: 'Scheduled', tone: 'yellow', hint: 'On the calendar' },
  { key: 'rescheduled', label: 'Rescheduled', tone: 'yellow', hint: 'Moved — the date shown is the new one' },
  { key: 'occurred', label: 'Occurred', tone: 'dark', hint: 'Happened, not yet reviewed for special actions' },
  { key: 'reviewed', label: 'Reviewed', tone: 'green', hint: 'Special actions and FOR RECORD items pulled out' },
  { key: 'complete', label: 'Complete', tone: 'soft', hint: 'Set automatically once every special action from it is done, cancelled or archived' },
  { key: 'cancelled', label: 'Cancelled', tone: 'outline', hint: 'Not happening' },
];

export const MEETING_LOCATION_TYPES: { key: MeetingLocationType; label: string; short: string; hint: string }[] = [
  { key: 'virtual', label: 'Virtual Meeting Online', short: 'Virtual', hint: 'Video call: Zoom, Meet, Teams…' },
  { key: 'call', label: 'Call Meeting (Voice/Audio)', short: 'Call', hint: 'Phone or audio-only' },
  { key: 'text', label: 'Text Meeting', short: 'Text', hint: 'Written via text, group chat or a written exchange — not email' },
  { key: 'in_person', label: 'In-Person', short: 'In person', hint: 'On site or another location' },
];

/** Older rows ("held") read as the new statuses, matching the server. */
export function meetingStatus(raw?: string | null): MeetingStatus {
  const s = String(raw || '').trim().toLowerCase();
  if (MEETING_STATUSES.some((x) => x.key === s)) return s as MeetingStatus;
  if (s === 'held') return 'occurred';
  if (s === 'canceled') return 'cancelled';
  return 'scheduled';
}
export const meetingStatusInfo = (raw?: string | null) => MEETING_STATUSES.find((s) => s.key === meetingStatus(raw))!;
export const locationTypeInfo = (k?: string | null) => MEETING_LOCATION_TYPES.find((l) => l.key === k);

/** Still on the calendar (scheduled or moved) -- as opposed to happened, called off or done. */
export const isPlanned = (raw?: string | null) => ['scheduled', 'rescheduled'].includes(meetingStatus(raw));
/** Needs someone to go through it: it happened (or its date passed) and no one has reviewed it yet. */
export const needsReview = (m: Pick<Meeting, 'status' | 'date'>, today: string) =>
  meetingStatus(m.status) === 'occurred' || (isPlanned(m.status) && !!m.date && m.date < today);
