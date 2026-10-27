import { PeopleService } from './people.service';

function repoOf(rows: any[]) {
  return {
    rows,
    find: jest.fn(async () => rows),
    findOneBy: jest.fn(async (w: any) => rows.find((r) => r.id === w.id) || null),
    save: jest.fn(async (x: any) => { for (const r of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((y) => y.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); } return x; }),
    create: (x: any) => x,
  };
}

describe('People: expired reason and "same person"', () => {
  it('Expired needs a reason', async () => {
    const repo = repoOf([{ id: 1, name: 'Kai Lono', contactStatus: 'active' }]);
    const svc = new PeopleService(repo as any);
    await expect(svc.update('1', { contactStatus: 'expired', contactStatusReason: ' ' })).rejects.toThrow('Say why this contact is expired.');
    const saved = await svc.update('1', { contactStatus: 'expired', contactStatusReason: 'Left the company' });
    expect(saved).toMatchObject({ contactStatus: 'expired', contactStatusReason: 'Left the company' });
  });
  it('a new contact confirmed as the same person is linked both ways; unlinking undoes both', async () => {
    const repo = repoOf([{ id: 1, name: 'Kai Lono', contactStatus: 'expired' }]);
    const svc = new PeopleService(repo as any);
    const created: any = await svc.create({ name: 'Kai Lono', kind: 'Consultant', sameAsId: 1 });
    expect(created.sameAsIds).toEqual([1]);
    expect(repo.rows.find((r) => r.id === 1).sameAsIds).toEqual([created.id]);
    expect(created).not.toHaveProperty('sameAsId');
    await svc.unlink(String(created.id), '1');
    expect(repo.rows.map((r) => r.sameAsIds)).toEqual([[], []]);
  });
  it('lists likely duplicates', async () => {
    const svc = new PeopleService(repoOf([{ id: 1, name: 'Kai Lono', phone: '808 555 0101', contactStatus: 'expired' }]) as any);
    expect((await svc.duplicates({ phone: '(808) 555-0101' })).map((r) => r.id)).toEqual([1]);
  });
});
