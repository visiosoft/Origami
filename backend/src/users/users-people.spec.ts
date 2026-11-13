import { UsersService } from './users.service';

/** Logins and People (Oct 30 sync): a login without a People record can't be given projects. */
describe('UsersService: every login has a People record', () => {
  const setup = (people: any[], users: any[]) => {
    const repo = { find: async () => users, save: async (u: any) => { users.push(u); return u; }, create: (x: any) => x, findOneBy: async (w: any) => users.find((u) => u.id === w.id) || null };
    const peopleRepo = { find: async () => people, save: async (p: any) => { const i = people.findIndex((x) => x.id === p.id); if (i >= 0) people[i] = p; else people.push(p); return p; }, create: (x: any) => x };
    const auth = { findByEmail: async () => null, sendInvite: async () => ({ sent: false }) };
    return new UsersService(repo as any, {} as any, {} as any, auth as any, peopleRepo as any);
  };

  it('links a new login to the person with its email, or adds one', async () => {
    const people = [{ id: 4, name: 'George', email: 'GEORGE@origami.com', projects: ['Countryside'] }];
    const svc = setup(people, []);
    await svc.create({ name: 'George', email: 'george@origami.com', roleKey: 'super' });
    expect(people[0]).toMatchObject({ userId: expect.stringMatching(/^U-/), projects: ['Countryside'] });
    await svc.create({ name: 'George test', email: 'george.test@origami.com', roleKey: 'super' });
    expect(people[1]).toMatchObject({ id: 5, name: 'George test', email: 'george.test@origami.com', tier: 'Internal', kind: 'Staff', projects: [] });
  });

  it('new accounts never share an id, even made in the same instant (Nov 13)', async () => {
    const users: any[] = [];
    const svc = setup([], users);
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    await svc.create({ name: 'A', email: 'a@o.com', roleKey: 'super' });
    await svc.create({ name: 'B', email: 'b@o.com', roleKey: 'super' });
    jest.restoreAllMocks();
    expect(new Set(users.map((u) => u.id)).size).toBe(2);
    await expect(svc.create({ id: users[0].id, name: 'C', email: 'c@o.com', roleKey: 'super' })).rejects.toThrow(/already has the id/);
  });

  it('lists logins left out of People, and adds them when asked', async () => {
    const people = [{ id: 1, name: 'Ed', email: 'ed@o.com', userId: 'U-1', projects: [] }, { id: 2, name: 'Sara', email: 'sara@o.com', projects: [] }];
    const users = [{ id: 'U-1', name: 'Ed', email: 'ed@o.com', tier: 'internal' }, { id: 'U-2', name: 'Sara', email: 'sara@o.com', tier: 'internal' },
      { id: 'U-3', name: 'Client Co', email: 'c@x.com', tier: 'client' }, { id: 'GUEST-9', name: 'Guest', email: 'g@x.com', tier: 'client' }];
    const svc = setup(people, users);
    expect((await svc.unlinked()).map((u) => u.id)).toEqual(['U-3']);
    expect(await svc.linkAllPeople()).toEqual({ linked: 2 });
    expect(people.find((p) => p.id === 2)!.userId).toBe('U-2');
    expect(people.find((p) => p.email === 'c@x.com')).toMatchObject({ tier: 'Client', kind: 'Client', userId: 'U-3' });
    expect(await svc.unlinked()).toEqual([]);
  });
});
