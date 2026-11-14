import { GoogleNotesService } from './google-notes.service';

const DOC = 'Weekly Sync - Notes by Gemini\nSummary\nWe agreed the plan.\n\nTranscript\nEd: hello';

describe('meeting notes through an attendee’s own Google (Nov 13)', () => {
  function setup(meeting: any, users: any[], docs: Record<string, { id: string; name: string }[] | null>) {
    const saved: any[] = [];
    const meetings = { find: async () => [meeting], save: async (m: any) => { saved.push(m); return m; }, findOneBy: async () => meeting };
    const calendar = {
      findDocsAs: async (uid: string) => docs[uid] ?? [],
      docTextAs: async () => ({ text: DOC, link: 'https://docs.google.com/document/d/D1' }),
    };
    const usersRepo = { find: async () => users };
    const google = { isConnected: async () => false };
    return { svc: new GoogleNotesService(meetings as any, google as any, undefined, calendar as any, usersRepo as any), saved };
  }

  it('the workspace account can’t see the Doc: an attendee’s connection finds it -- by id or any of their addresses', async () => {
    const m: any = { id: 'MT1', title: 'Weekly Sync', date: '2026-11-13', time: '08:00', attendees: [{ name: 'Astrid', email: 'astrid@apogeec.com' }], minutes: '' };
    const users = [
      { id: 'U-9', name: 'Not invited', calendarRefreshToken: 'r9', email: 'x@o.com' },
      { id: 'U-2', name: 'Astrid', calendarRefreshToken: 'r2', email: 'astrid@origami.com', altEmails: ['astrid@apogeec.com'] },
    ];
    const { svc, saved } = setup(m, users, { 'U-9': [{ id: 'NOPE', name: 'x' }], 'U-2': [{ id: 'D1', name: 'Weekly Sync - 2026/11/13 08:00 PST - Notes by Gemini' }] });
    const r = await svc.sweep(new Date('2026-11-13T20:00:00Z'));
    expect(r).toEqual({ checked: 1, imported: 1 });
    expect(saved[0]).toMatchObject({ notesDocId: 'D1', status: 'occurred', transcriptUrl: 'https://docs.google.com/document/d/D1' });
    expect(saved[0].minutes).toContain('We agreed the plan');
  });

  it('a connection made before Nov 13 (no Drive permission) is skipped quietly', async () => {
    const m: any = { id: 'MT2', title: 'Site walk', date: '2026-11-13', time: '08:00', attendees: [{ id: 'U-3', name: 'Ed' }], minutes: '' };
    const { svc, saved } = setup(m, [{ id: 'U-3', name: 'Ed', calendarRefreshToken: 'r3', email: 'ed@o.com' }], { 'U-3': null });
    expect(await svc.sweep(new Date('2026-11-13T20:00:00Z'))).toEqual({ checked: 1, imported: 0 });
    expect(saved).toEqual([]);
  });
});
