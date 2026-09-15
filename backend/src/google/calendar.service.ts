import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GoogleService } from './google.service';

const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface BusyBlock { start: string; end: string }
export interface CalendarAvailability {
  email: string;
  /** null means Google would not say -- a calendar the connected account cannot see into. */
  busy: BusyBlock[] | null;
  error?: string;
}

export interface ScheduleEventInput {
  eventId?: string;
  summary: string;
  description?: string;
  start: string; // ISO
  end: string;   // ISO
  location?: string;
  attendees?: string[];
  /** Adds a Google Meet link when true -- skipped for a phone consultation. */
  video?: boolean;
}

/**
 * Real Google Calendar access, on top of GoogleService's OAuth token -- kept
 * as its own service rather than folded into GoogleService, which is already
 * doing mail, Drive and Docs; calendar is a fourth, separable concern with
 * its own two narrow scopes.
 */
@Injectable()
export class CalendarService {
  private readonly log = new Logger('CalendarService');

  constructor(private readonly google: GoogleService) {}

  /**
   * Free/busy for a list of calendars over one window. A calendar the
   * connected account cannot see into (no sharing, wrong domain, a bad
   * address) comes back with `busy: null` and an error, not a thrown
   * exception -- one unreadable calendar should not block reading the rest.
   */
  async freeBusy(emails: string[], timeMin: string, timeMax: string): Promise<CalendarAvailability[]> {
    const clean = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
    if (!clean.length) return [];
    const token = await this.google.workspaceToken();
    const res = await fetch(FREEBUSY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin, timeMax, items: clean.map((id) => ({ id })) }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`freeBusy failed: ${JSON.stringify(body)}`);
      throw new BadRequestException(body?.error?.message || 'Could not read calendar availability.');
    }
    const calendars = body?.calendars || {};
    return clean.map((email) => {
      const cal = calendars[email];
      if (!cal || cal.errors?.length) {
        return { email, busy: null, error: cal?.errors?.[0]?.reason || 'not shared with this account' };
      }
      return { email, busy: (cal.busy || []).map((b: any) => ({ start: b.start, end: b.end })) };
    });
  }

  /**
   * Create or update a real event on the connected account's primary
   * calendar. Passing `eventId` (from a prior create) updates that event in
   * place instead of leaving a duplicate on the calendar.
   */
  async scheduleEvent(input: ScheduleEventInput): Promise<{ id: string; htmlLink: string; meetLink?: string }> {
    const token = await this.google.workspaceToken();
    const body: any = {
      summary: input.summary,
      description: input.description || '',
      start: { dateTime: input.start },
      end: { dateTime: input.end },
    };
    if (input.location) body.location = input.location;
    if (input.attendees?.length) body.attendees = input.attendees.map((email) => ({ email }));
    if (input.video) {
      body.conferenceData = { createRequest: { requestId: `origami-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
    }

    const url = input.eventId ? `${EVENTS_URL}/${encodeURIComponent(input.eventId)}` : EVENTS_URL;
    const params = new URLSearchParams({ sendUpdates: 'all' });
    if (input.video) params.set('conferenceDataVersion', '1');

    const res = await fetch(`${url}?${params.toString()}`, {
      method: input.eventId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`Calendar event ${input.eventId ? 'update' : 'create'} failed: ${JSON.stringify(json)}`);
      throw new BadRequestException(json?.error?.message || 'Google Calendar rejected the event.');
    }
    const meetLink = json?.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;
    return { id: json.id, htmlLink: json.htmlLink, meetLink };
  }
}
