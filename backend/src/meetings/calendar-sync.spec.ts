import { isMeetingEvent, localParts, notesDocOf, planSync, projectFor, type CalEvent } from './calendar-sync';
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

  it('a meeting is timed, has two people (rooms aside), and wasn’t declined', () => {
    expect(isMeetingEvent(ev({ id: 'a' }))).toBe(true);
    expect(isMeetingEvent(ev({ id: 'b', start: { date: '2026-11-18' } }))).toBe(false);
    expect(isMeetingEvent(ev({ id: 'c', attendees: [{ email: 'astrid@origamidb.com', self: true }] }))).toBe(false);
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

  it('one meeting in several people’s calendars is one; a copy cancelled for one guest does not cancel it', () => {
    const { mergeEvents } = require('./calendar-sync.service');
    const out = mergeEvents([ev({ id: 'X', status: 'cancelled' }), ev({ id: 'X' }), ev({ id: 'Y' }), ev({ id: 'Y' })]);
    expect(out.map((e: any) => [e.id, e.status])).toEqual([['X', 'confirmed'], ['Y', 'confirmed']]);
    const declined = { ...ev({ id: 'Z' }), attendees: [{ email: 'a@origamidb.com', self: true, responseStatus: 'declined' }, { email: 'b@origamidb.com' }] };
    const going = { ...ev({ id: 'Z' }), attendees: [{ email: 'a@origamidb.com', responseStatus: 'declined' }, { email: 'b@origamidb.com', self: true, responseStatus: 'accepted' }] };
    expect(mergeEvents([declined, going])[0]).toBe(going);
  });

  describe('service', () => {
    const make = (events: CalEvent[]) => {
      const store: Record<string, string> = {};
      const meetings: any[] = [];
      const created: any[] = [];
      const svc = new CalendarSyncService(
        { find: async () => meetings, findOneBy: async (w: any) => meetings.find((m) => m.id === w.id) || null, save: async (m: any) => m } as any,
        { find: async () => [
          { id: 'U-A', name: 'Astrid Rivas', email: 'astrid@origamidb.com', status: 'active', calendarRefreshToken: 'rt-a', calendarEmail: 'astrid@origamidb.com' },
          { id: 'U-B', name: 'Ehsan', email: 'ehsan@origamidb.com', status: 'active', calendarRefreshToken: 'rt-b', calendarEmail: 'ehsan@origamidb.com' },
          { id: 'U-C', name: 'No calendar', email: 'c@origamidb.com', status: 'active' },
        ] } as any,
        { find: async () => projects } as any,
        { get: async (k: string) => store[k] ?? null, set: async (k: string, v: string) => { store[k] = v; } } as any,
        { isConnected: async () => true, status: async () => ({ connected: true, connectedEmail: 'office@origamidb.com' }) } as any,
        // Each person's own calendar (Nov 20): the same meeting is in both, once here.
        { userEvents: async (uid: string) => (uid === 'U-A' ? events : events.slice(0, 1)) } as any,
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
      expect((await svc.status('U-B'))).toMatchObject({ applied: true, on: true, connected: true, connectedEmail: 'ehsan@origamidb.com', people: 2 });
      expect((await svc.status('U-C'))).toMatchObject({ connected: false, connectedEmail: '', people: 2 });
      expect(await svc.tick()).toMatchObject({ created: 0 });
      expect(created).toHaveLength(2);
      await svc.setOn(false);
      expect(await svc.tick()).toBeNull();
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
