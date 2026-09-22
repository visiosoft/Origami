import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GoogleService } from './google.service';

const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface MyCalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink?: string;
}

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
  /** One access token per user, refreshed on demand -- separate from
   *  GoogleService's single cached token, which is for the one shared
   *  workspace connection, not any particular person's own calendar. */
  private userTokens = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly google: GoogleService) {}

  /** A person's own access token, refreshed from their stored refresh token. */
  private async userToken(userId: string, refreshToken: string): Promise<string> {
    const cached = this.userTokens.get(userId);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
    const { clientId, clientSecret } = await this.google.credentials();
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }).toString(),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`Personal calendar refresh failed for ${userId}: ${JSON.stringify(body)}`);
      throw new BadRequestException('Your calendar connection expired. Reconnect it under your account settings.');
    }
    const token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    this.userTokens.set(userId, token);
    return token.value;
  }

  /**
   * One person's own events for a window -- their real calendar, not a
   * busy/free strip. Read-only: this never writes anything to their calendar.
   */
  async myEvents(userId: string, refreshToken: string, timeMin: string, timeMax: string): Promise<MyCalendarEvent[]> {
    const token = await this.userToken(userId, refreshToken);
    const params = new URLSearchParams({
      timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '50',
    });
    const res = await fetch(`${EVENTS_URL}?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`myEvents failed: ${JSON.stringify(body)}`);
      throw new BadRequestException(body?.error?.message || 'Could not read your calendar.');
    }
    return (body.items || []).map((e: any) => ({
      id: e.id,
      summary: e.summary || '(no title)',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      allDay: !e.start?.dateTime,
      htmlLink: e.htmlLink,
    }));
  }

  /**
   * Create an event on the signed-in user's OWN primary calendar, using
   * their personal refresh token (not the shared workspace one). Used by My
   * Calendar's click-to-create "Google Meet" flow.
   */
  async createMyEvent(userId: string, refreshToken: string, input: ScheduleEventInput): Promise<MyCalendarEvent & { meetLink?: string }> {
    const token = await this.userToken(userId, refreshToken);
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
    // sendUpdates=all is what makes Google email an invite to every guest.
    const params = new URLSearchParams({ sendUpdates: 'all' });
    if (input.video) params.set('conferenceDataVersion', '1');
    const res = await fetch(`${EVENTS_URL}?${params.toString()}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      this.log.error(`createMyEvent failed (${res.status}): ${JSON.stringify(json)}`);
      // A connection made before write access existed only has the read-only
      // scope -- Google rejects the write with 403 rather than upgrading it.
      if (res.status === 403) {
        throw new BadRequestException('Your calendar connection needs to be reconnected to create events. Go to Settings → My Calendar, disconnect, and connect again.');
      }
      throw new BadRequestException(json?.error?.message || 'Google Calendar rejected the event.');
    }
    const meetLink = json?.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;
    return {
      id: json.id,
      summary: json.summary || input.summary,
      start: json.start?.dateTime || json.start?.date,
      end: json.end?.dateTime || json.end?.date,
      allDay: !json.start?.dateTime,
      htmlLink: json.htmlLink,
      meetLink,
    };
  }

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
   * Create or update a real event on the SIGNED-IN USER's own primary
   * calendar -- so a meeting scheduled from a lead shows up on My Calendar,
   * the same place any other personally-created event does, rather than on
   * a separate shared workspace calendar nobody's My Calendar view reads
   * from. Passing `eventId` (from a prior create) updates that event in
   * place instead of leaving a duplicate on the calendar -- this is what
   * lets a missed meeting be rescheduled rather than re-created each time.
   */
  async scheduleMyEvent(userId: string, refreshToken: string, input: ScheduleEventInput): Promise<{ id: string; htmlLink: string; meetLink?: string }> {
    const token = await this.userToken(userId, refreshToken);
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
      if (res.status === 403) {
        throw new BadRequestException('Your calendar connection needs to be reconnected to create events. Go to Settings → My Calendar, disconnect, and connect again.');
      }
      throw new BadRequestException(json?.error?.message || 'Google Calendar rejected the event.');
    }
    const meetLink = json?.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;
    return { id: json.id, htmlLink: json.htmlLink, meetLink };
  }
}
