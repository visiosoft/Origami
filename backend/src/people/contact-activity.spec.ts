import { ContactActivityService } from './contact-activity.service';
import { AUTO_REVIEW_REASON } from './contact-status';

const table = (rows: any[]) => ({
  rows,
  find: jest.fn(async () => rows),
  findOneBy: jest.fn(async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null),
  save: jest.fn(async (x: any) => { for (const r of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((y) => y.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); } return x; }),
  create: (x: any) => x,
  remove: jest.fn(async (x: any) => { rows.splice(rows.indexOf(x), 1); }),
}) as any;

describe('contact activity', () => {
  it('logging a call moves last activity and lifts the automatic 12-month Review', async () => {
    const people = table([{ id: 1, name: 'Kai', kind: 'Client', company: 'Kestrel', contactStatus: 'review', contactStatusReason: AUTO_REVIEW_REASON, lastActivityAt: '2025-01-01T00:00:00Z' }]);
    const svc = new ContactActivityService(people, table([]), table([]));
    await svc.log('1', { kind: 'call', at: '2026-10-20', note: 'Checked in' }, { id: 'U-1', name: 'Edward' });
    expect(people.rows[0]).toMatchObject({ contactStatus: 'active', lastActivityAt: '2026-10-20T12:00:00.000Z' });
    await expect(svc.log('1', { kind: 'fax' }, null)).rejects.toThrow('Pick call');
    await expect(svc.log('1', { kind: 'note', note: ' ' }, null)).rejects.toThrow('Type the note');
  });
  it('one point of contact per company', async () => {
    const people = table([
      { id: 1, name: 'Kai', kind: 'Client', company: 'Kestrel', pointOfContact: true },
      { id: 2, name: 'Ivy', kind: 'Client', company: 'kestrel ' },
      { id: 3, name: 'Kestrel', kind: 'Sub', company: '' },
    ]);
    const svc = new ContactActivityService(people, table([]), table([]));
    await svc.setPointOfContact('2', true);
    expect(people.rows.map((r: any) => !!r.pointOfContact)).toEqual([false, true, false]);
    const a = await svc.activity('3');
    expect(a.pointOfContact).toEqual({ id: 2, name: 'Ivy' });
  });
});
