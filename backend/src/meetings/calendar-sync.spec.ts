import { isMeetingEvent, localParts, mergeCalendars, notesDocOf, planSync, projectFor, type CalEvent } from './calendar-sync';
import { CalendarSyncService } from './calendar-sync.service';

/** Nov 19: "we connected our @origamidb calendar, but meetings aren't pulled in". */
describe('meetings from the company calendar', () => {
  const ev = (o: Partial<CalEvent> & { id: string }): CalEvent => ({
    status: 'confirmed', summary: 'OAC — Countryside', start: { dateTime: '2026-11-18T18:00:00Z' }, end: { dateTime: '2026-11-18T19:00:00Z' },
    organizer: { email: 'astrid@origamidb.com' }, hangoutLink: 'https://meet.google.com/abc-defg-hij',
    attendees: [{ email: 'astrid@origamidb.com', self: true, responseStatus: 'accepted' }, { email: 'kai@lono.test', displayName: 'Kai Lono' }, { email: 'room-1@resource.calendar.google.com', resource: true }],
    ...o,
  });
  const users = [{ id: 'U-A', name: 'Astrid Rivas', emails: ['astrid@origamidb.com'] }];
  const projects = [{ id: 7, name: 'Countryside' }, { id: 8, name: 'Hayes Valley' }];

  it('reads times in the company’s time zone', () => {
    expect(localParts('2026-11-18T18:00:00Z')).toEqual({ date: '2026-11-18', time: '10:00' });
    expect(localParts('2026-11-19T05:30:00Z')).toEqual({ date: '2026-11-18', time: '21:30' });
  });

  it('a meeting is timed, not private or a Google block, and wasn’t declined -- guests or not (Nov 20)', () => {
    expect(isMeetingEvent(ev({ id: 'a' }))).toBe(true);
    expect(isMeetingEvent(ev({ id: 'b', start: { date: '2026-11-18' } }))).toBe(false);
    expect(isMeetingEvent(ev({ id: 'c', attendees: [{ email: 'astrid@origamidb.com', self: true }] }))).toBe(true);
    expect(isMeetingEvent(ev({ id: 'c2', attendees: undefined }))).toBe(true);
    expect(isMeetingEvent(ev({ id: 'p', visibility: 'private' }))).toBe(false);
    expect(isMeetingEvent(ev({ id: 'o', eventType: 'outOfOffice' }))).toBe(false);
    expect(isMeetingEvent(ev({ id: 'f', eventType: 'focusTime' }))).toBe(false);
    expect(isMeetingEvent(ev({ id: 'd', attendees: [{ email: 'astrid@origamidb.com', self: true, responseStatus: 'declined' }, { email: 'x@y.z' }] }))).toBe(false);
  });

  it('a new event becomes a meeting with its guests, link, project and time', () => {
    const p = planSync([ev({ id: 'E1' })], [], users, projects, new Set(), 'origamidb.com');
    expect(p.create).toHaveLength(1);
    expect(p.create[0]).toMatchObject({
      title: 'OAC — Countryside', date: '2026-11-18', time: '10:00', type: 'Internal', locationType: 'virtual', location: 'https://meet.google.com/abc-defg-hij',
      projectId: 7, project: 'Countryside', calendarEventId: 'E1', status: 'scheduled',
      attendees: [{ id: 'U-A', name: 'Astrid Rivas', email: 'astrid@origamidb.com' }, { name: 'Kai Lono', email: 'kai@lono.test' }],
    });
    expect(planSync([ev({ id: 'E2', organizer: { email: 'plans@sfdbi.org', displayName: 'SF DBI' } })], [], users, projects, new Set(), 'origamidb.com').create[0]).toMatchObject({ type: 'Outside', organizer: 'SF DBI' });
  });

  it('follows a moved event, cancels a cancelled one, and never brings back an archived or deleted one', () => {
    const meetings = [
      { id: 'M1', calendarEventId: 'E1', date: '2026-11-17', time: '10:00', status: 'scheduled', title: 'OAC' },
      { id: 'M2', calendarEventId: 'E2', date: '2026-11-18', time: '10:00', status: 'scheduled', title: 'Site walk' },
      { id: 'M3', calendarEventId: 'E3', date: '2026-11-18', time: '10:00', status: 'scheduled', title: 'Test', archivedAt: '2026-11-19' },
      { id: 'M4', calendarEventId: 'E5', date: '2026-11-10', time: '09:00', status: 'reviewed', title: 'Done one' },
    ];
    const p = planSync([ev({ id: 'E1' }), ev({ id: 'E2', status: 'cancelled' }), ev({ id: 'E3' }), ev({ id: 'E4' }), ev({ id: 'E5' })], meetings, users, projects, new Set(['E4']), 'origamidb.com');
    expect(p.move).toEqual([{ id: 'M1', title: 'OAC', date: '2026-11-18', time: '10:00', from: '2026-11-17 10:00' }]);
    expect(p.cancel).toEqual([{ id: 'M2', title: 'Site walk' }]);
    expect(p.create).toHaveLength(0);
    expect(p.skipped).toBe(2);
  });

  it('finds Gemini’s notes attached to the event, and a project only when one matches', () => {
    expect(notesDocOf(ev({ id: 'x', attachments: [{ title: 'OAC - 2026/11/18 10:00 PST - Notes by Gemini', fileUrl: 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit', mimeType: 'application/vnd.google-apps.document' }] }))).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz');
    expect(notesDocOf(ev({ id: 'y' }))).toBeNull();
    expect(projectFor('Weekly sync', projects)).toBeNull();
    expect(projectFor('Hayes Valley + Countryside', projects)).toBeNull();
  });

  describe('everyone’s calendars together (Nov 20)', () => {
    const copy = (o: Partial<CalEvent> & { id: string }) => ev({ iCalUID: 'uid-1@google.com', ...o });
    const guestCopy = (o: Partial<CalEvent> & { id: string }) => copy({ organizer: { email: 'astrid@origamidb.com' }, attendees: [{ email: 'astrid@origamidb.com', responseStatus: 'accepted' }, { email: 'kai@origamidb.com', self: true, responseStatus: 'accepted' }], ...o });

    it('the same invite on two calendars is one meeting, found by either copy’s id', () => {
      const merged = mergeCalendars([
        { email: 'astrid@origamidb.com', personal: true, events: [copy({ id: 'A1', organizer: { email: 'astrid@origamidb.com', self: true } })] },
        { email: 'kai@origamidb.com', personal: true, events: [guestCopy({ id: 'K1' })] },
      ]);
      expect(merged).toHaveLength(1);
      expect(merged[0].ids).toEqual(['A1', 'K1']);
      expect(planSync(merged, [], users, projects, new Set(), 'origamidb.com').create).toHaveLength(1);
      const existing = [{ id: 'M1', calendarEventId: 'K1', date: '2026-11-18', time: '10:00', status: 'scheduled', title: 'OAC' }];
      const p = planSync(merged, existing, users, projects, new Set(), 'origamidb.com');
      expect(p.create).toHaveLength(0);
      expect(planSync(merged, [], users, projects, new Set(['K1']), 'origamidb.com').create).toHaveLength(0);
    });

    it('one guest removing it doesn’t cancel it; the organiser cancelling does', () => {
      const existing = [{ id: 'M1', calendarEventId: 'A1', date: '2026-11-18', time: '10:00', status: 'scheduled', title: 'OAC' }];
      const guestGone = mergeCalendars([
        { email: 'astrid@origamidb.com', personal: true, events: [copy({ id: 'A1', organizer: { email: 'astrid@origamidb.com', self: true } })] },
        { email: 'kai@origamidb.com', personal: true, events: [guestCopy({ id: 'K1', status: 'cancelled' })] },
      ]);
      expect(planSync(guestGone, existing, users, projects, new Set(), 'origamidb.com').cancel).toHaveLength(0);
      const organiserGone = mergeCalendars([
        { email: 'kai@origamidb.com', personal: true, events: [guestCopy({ id: 'K1' })] },
        { email: 'astrid@origamidb.com', personal: true, events: [copy({ id: 'A1', status: 'cancelled', organizer: { email: 'astrid@origamidb.com', self: true } })] },
      ]);
      expect(planSync(organiserGone, existing, users, projects, new Set(), 'origamidb.com').cancel).toEqual([{ id: 'M1', title: 'OAC' }]);
    });

    it('declined on one calendar but accepted on another still comes in; private ones stay out', () => {
      const declined = guestCopy({ id: 'K1', attendees: [{ email: 'astrid@origamidb.com' }, { email: 'kai@origamidb.com', self: true, responseStatus: 'declined' }] });
      expect(planSync(mergeCalendars([{ email: 'kai@origamidb.com', personal: true, events: [declined] }]), [], users, projects, new Set(), 'origamidb.com').create).toHaveLength(0);
      const both = mergeCalendars([{ email: 'kai@origamidb.com', personal: true, events: [declined] }, { email: 'astrid@origamidb.com', personal: true, events: [copy({ id: 'A1', organizer: { email: 'astrid@origamidb.com', self: true } })] }]);
      expect(planSync(both, [], users, projects, new Set(), 'origamidb.com').create).toHaveLength(1);
      expect(planSync(mergeCalendars([{ email: 'kai@origamidb.com', personal: true, events: [guestCopy({ id: 'K2', visibility: 'private' })] }]), [], users, projects, new Set(), 'origamidb.com').create).toHaveLength(0);
    });

    it('a solo event on someone’s own calendar has them as its attendee', () => {
      const merged = mergeCalendars([{ email: 'astrid@origamidb.com', personal: true, events: [ev({ id: 'S1', summary: 'Plan review', attendees: undefined, hangoutLink: undefined })] }]);
      expect(planSync(merged, [], users, projects, new Set(), 'origamidb.com').create[0]).toMatchObject({ title: 'Plan review', attendees: [{ id: 'U-A', name: 'Astrid Rivas', email: 'astrid@origamidb.com' }] });
    });

    it('repeating events stay one meeting per occurrence', () => {
      const occ = (id: string, day: string) => ev({ id, iCalUID: 'weekly@google.com', originalStartTime: { dateTime: `${day}T18:00:00Z` }, start: { dateTime: `${day}T18:00:00Z` } });
      expect(mergeCalendars([{ email: 'a@o.co', personal: true, events: [occ('W_1', '2026-11-18'), occ('W_2', '2026-11-25')] }, { email: 'b@o.co', personal: true, events: [occ('W_1', '2026-11-18')] }])).toHaveLength(2);
    });
  });

  describe('service', () => {
    const make = (events: CalEvent[], personal: Record<string, CalEvent[] | Error> = {}) => {
      const store: Record<string, string> = {};
      const meetings: any[] = [];
      const created: any[] = [];
      const svc = new CalendarSyncService(
        { find: async () => meetings, findOneBy: async (w: any) => meetings.find((m) => m.id === w.id) || null, save: async (m: any) => m } as any,
        { find: async () => [
          { id: 'U-A', name: 'Astrid Rivas', email: 'astrid@origamidb.com', status: 'active', tier: 'internal', calendarRefreshToken: personal['U-A'] ? 'r' : '' },
          { id: 'U-K', name: 'Kai', email: 'kai@origamidb.com', status: 'active', tier: 'internal', calendarRefreshToken: personal['U-K'] ? 'r' : '' },
          { id: 'U-E', name: 'Ed', email: 'ed@origamidb.com', status: 'active', tier: 'internal' },
        ] } as any,
        { find: async () => projects } as any,
        { get: async (k: string) => store[k] ?? null, set: async (k: string, v: string) => { store[k] = v; } } as any,
        { isConnected: async () => true, status: async () => ({ connected: true, connectedEmail: 'office@origamidb.com' }) } as any,
        { companyEvents: async () => events, eventsAs: async (id: string) => { const r = personal[id]; if (r instanceof Error) throw r; return r || []; } } as any,
        { create: async (dto: any) => { const m = { id: 'M' + (meetings.length + 1), ...dto }; meetings.push(m); created.push(m); return m; } } as any,
      );
      return { svc, store, meetings, created };
    };

    it('the first run is a preview; Apply makes the meetings; then it runs hourly without duplicates', async () => {
      const { svc, created } = make([ev({ id: 'E1' }), ev({ id: 'E2', summary: 'Design review' })]);
      expect(await svc.tick()).toBeNull(); // not applied yet: the hourly run waits for a person
      const pv = await svc.preview();
      expect(pv.create.map((c) => c.title)).toEqual(['OAC — Countryside', 'Design review']);
      expect(created).toHaveLength(0);
      expect(await svc.apply({ name: 'Astrid' })).toMatchObject({ created: 2, events: 2 });
      expect((await svc.status())).toMatchObject({ applied: true, on: true, connectedEmail: 'office@origamidb.com' });
      expect(await svc.tick()).toMatchObject({ created: 0 });
      expect(created).toHaveLength(2);
      await svc.setOn(false);
      expect(await svc.tick()).toBeNull();
    });

    it('reads everyone’s own calendars once applied; one failing doesn’t stop the rest', async () => {
      const shared = ev({ id: 'E1', iCalUID: 'u1' });
      const { svc, created } = make([shared], { 'U-A': [{ ...shared }, ev({ id: 'P1', iCalUID: 'p1', summary: 'Design review' })], 'U-K': new Error('Calendar connection needs reconnecting') });
      const st = await svc.status();
      expect(st).toMatchObject({ scope: 'everyone', people: [{ name: 'Astrid Rivas' }, { name: 'Kai' }], notConnected: 1 });
      const pv = await svc.preview();
      expect(pv.create.map((c) => c.title)).toEqual(['OAC — Countryside', 'Design review']);
      expect(pv.sources.map((s) => [s.name, s.ok])).toEqual([['Company calendar', true], ['Astrid Rivas', true], ['Kai', false]]);
      await svc.apply();
      expect(created).toHaveLength(2);
      expect((await svc.status()).scope).toBe('everyone');
    });

    it('an earlier company-only sync keeps reading the company calendar hourly until someone applies with everyone', async () => {
      const { svc, store, created } = make([ev({ id: 'E1' })], { 'U-A': [ev({ id: 'P1', iCalUID: 'p1', summary: 'Design review' })] });
      // Nov 27 (Weekly Sync): everyone's calendars are read hourly by default; 'company' only when set so.
      store['meetings.calendarSync'] = JSON.stringify({ on: true, applied: true, scope: 'company' });
      await svc.tick();
      expect(created.map((c) => c.title)).toEqual(['OAC — Countryside']);
    });

    it('remembers deleted meetings’ events', async () => {
      const { svc, created } = make([ev({ id: 'E9' })]);
      await svc.skip(['E9']);
      expect((await svc.preview()).create).toHaveLength(0);
      await svc.apply();
      expect(created).toHaveLength(0);
    });
  });
});
