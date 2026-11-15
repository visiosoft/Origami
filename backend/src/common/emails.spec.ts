import { cleanAltEmails, emailsOf, sharesEmail } from './emails';
import { UsersService } from '../users/users.service';
import { WeeklyTimesheetsService } from '../manpower/weekly-timesheets.service';
import { AuthService } from '../auth/auth.service';

describe('second emails per person (Nov 13)', () => {
  it('cleans the list: valid, lower-case, not the main one, no repeats', () => {
    expect(cleanAltEmails(' Astrid@ApogeeC.com, astrid@apogeec.com; nope , astrid@origami.com', 'Astrid@Origami.com')).toEqual(['astrid@apogeec.com']);
    expect(emailsOf({ email: '—', altEmails: ['a@b.co'] })).toEqual(['a@b.co']);
    expect(sharesEmail({ email: 'x@origami.com' }, { email: 'y@z.com', altEmails: ['X@origami.com'] })).toBe(true);
    expect(sharesEmail({ email: '' }, { email: '' })).toBe(false);
  });

  it('sign-in finds the account by an other email; the main email wins', async () => {
    const rows = [
      { id: 'U-2', name: 'Other', email: 'shared@x.com' },
      { id: 'U-1', name: 'Astrid', email: 'astrid@origami.com', altEmails: ['astrid@apogeec.com'] },
    ];
    const qb: any = { where: () => qb, orWhere: () => qb, getMany: async () => rows };
    const auth = Object.create(AuthService.prototype);
    auth.users = { createQueryBuilder: () => qb };
    expect((await auth.findByEmail('Astrid@ApogeeC.com'))?.id).toBe('U-1');
    expect((await auth.findByEmail('shared@x.com'))?.id).toBe('U-2');
    expect(await auth.findByEmail('nobody@x.com')).toBeNull();
  });

  it('an other email can’t belong to a second account', async () => {
    const users: any[] = [{ id: 'U-1', name: 'Astrid', email: 'astrid@origami.com' }];
    const repo = { findOneBy: async (w: any) => users.find((u) => u.id === w.id) || null, save: async (u: any) => u, create: (x: any) => x };
    const auth = { findByEmail: async (e: string) => (e === 'taken@x.com' ? { id: 'U-9', name: 'Bob' } : null) };
    const svc = new UsersService(repo as any, {} as any, {} as any, auth as any);
    await expect(svc.update('U-1', { altEmails: ['taken@x.com'] })).rejects.toThrow(/belongs to Bob/);
    const saved: any = await svc.update('U-1', { altEmails: ['ASTRID@apogeec.com', 'astrid@origami.com'] });
    expect(saved.altEmails).toEqual(['astrid@apogeec.com']);
  });

  it('timesheets: a login links to its employee record through either address', async () => {
    const employees: any[] = [{ id: 'EMP-1', name: 'Astrid', email: 'astrid@origami.com' }];
    const repo = (rows: any[]) => ({ findOneBy: async (w: any) => rows.find((r) => Object.entries(w).every(([k, v]) => r[k] === v)) || null, find: async () => rows, save: async (x: any) => x });
    const users = [{ id: 'U-1', email: 'astrid@apogeec.com', altEmails: ['astrid@origami.com'] }];
    const none: any = {};
    const svc = new WeeklyTimesheetsService(none, none, repo(employees) as any, none, none, none, none, none, repo(users) as any, none, none, none, none);
    expect((await svc.me({ id: 'U-1' } as any))?.id).toBe('EMP-1');
    expect(employees[0].userId).toBe('U-1');
  });
});
