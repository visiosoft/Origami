import { docIdFrom, endedBefore, notesQuery, splitGeminiDoc } from './google-notes';
import { GoogleNotesService } from './google-notes.service';

const DOC = `Please rate the new Quick notes tab by taking a short survey.

Weekly Sync - Ehsan + Origami DB

Nov 3, 2026
Summary
System review discussed.

Next steps
[IT and Systems Department] Enable Thumbnail View: Implement a thumbnail grid view for project photos.

You should review Gemini's notes to make sure they're accurate. Get tips and learn how Gemini takes notes
Weekly Sync - Ehsan + Origami DB - Transcript
00:02:04
Edward Ciccarelli: Ehsan.`;

describe('meeting notes from Google (Nov 3 sync)', () => {
  it('reads a Doc id from a link', () => {
    expect(docIdFrom('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit?usp=sharing')).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
    expect(docIdFrom('not a link')).toBeNull();
  });
  it('searches by title, date and "Notes by Gemini"', () => {
    expect(notesQuery("Weekly Sync - Ehsan + Origami's DB", '2026-11-03')).toBe("name contains 'Notes by Gemini' and name contains 'Weekly Sync - Ehsan + Origami s DB' and name contains '2026/11/03'");
  });
  it('splits the notes from the transcript and drops Gemini’s footers', () => {
    const { notes, transcript } = splitGeminiDoc(DOC);
    expect(notes.startsWith('Weekly Sync - Ehsan + Origami DB')).toBe(true);
    expect(notes).toContain('[IT and Systems Department] Enable Thumbnail View');
    expect(notes).not.toMatch(/Please rate|You should review/);
    expect(transcript.startsWith('Weekly Sync - Ehsan + Origami DB - Transcript')).toBe(true);
  });
  it('knows when a meeting has ended', () => {
    const now = new Date('2026-11-03T12:00:00');
    expect(endedBefore('2026-11-03', '10:00', now)).toBe(true);
    expect(endedBefore('2026-11-03', '11:30', now)).toBe(false);
    expect(endedBefore('2026-11-02', '', now)).toBe(true);
  });
  it('the hourly sweep saves the notes on meetings that ended without any', async () => {
    const rows: any[] = [
      { id: 'M1', title: 'Weekly Sync', date: '2026-11-03', time: '08:30', minutes: '' },
      { id: 'M2', title: 'Has notes', date: '2026-11-03', time: '08:30', minutes: 'already' },
      { id: 'M3', title: 'Later today', date: '2026-11-03', time: '23:00', minutes: '' },
    ];
    const google = {
      isConnected: async () => true,
      findDocs: jest.fn(async () => [{ id: 'DOC1' }]),
      exportDocText: jest.fn(async () => ({ name: 'x', link: 'https://docs.google.com/document/d/DOC1', text: DOC })),
    };
    const svc = new GoogleNotesService({ find: async () => rows, save: async (m: any) => m, findOneBy: async () => null } as any, google as any);
    expect(await svc.sweep(new Date('2026-11-03T12:00:00'))).toEqual({ checked: 1, imported: 1 });
    expect(rows[0].notesDocId).toBe('DOC1');
    expect(rows[0].minutes).toContain('Next steps');
    expect(rows[0].transcript).toContain('Edward Ciccarelli: Ehsan.');
    expect(rows[0].transcriptUrl).toBe('https://docs.google.com/document/d/DOC1');
  });
});
