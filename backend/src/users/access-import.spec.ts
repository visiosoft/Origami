import { AccessImportService } from './access-import.service';

const SHEET: string[][] = [
  ['', 'RANK', 'I - 1', '', '', 'I - 2', '', '', 'C - 1', '', ''],
  ['', 'BUCKET', 'INTERNAL', '', '', 'INTERNAL', '', '', 'CLIENT', '', ''],
  ['', 'CLASSIFICATION', 'HIGH LEVEL', '', '', 'STAFF', '', '', 'CLIENT', '', ''],
  ['', 'Email/Account to Test', 'boss@x.com', '', '', 'pm@x.com\nPass1*', '', '', 'pm@x.com', '', ''],
  ['', 'ROLE', 'INTERNAL EXECUTIVE', '', '', 'INTERNAL PROJECT MANAGER', '', '', 'CLIENT OPEN BOOK', '', ''],
  ['', 'DATA TYPE', 'ACCESS TYPE', 'Extent', 'Note', 'ACCESS TYPE', 'Extent', 'Note', 'ACCESS TYPE', 'Extent', 'Note'],
  ['', 'OVERALL ACCESS', 'FULL EDIT', 'Portfolio', '', 'MODIFY', 'Assigned Projects', '', 'VIEW ONLY', 'Assigned Projects', ''],
  ['', '-RFI', 'FULL EDIT', 'Portfolio', '', 'BLOCK ACCESS', '', '', 'VIEW ONLY', '', ''],
];

const setup = () => {
  const roles: any[] = [{ key: 'admin', name: 'Administrator', tier: 'internal', permissions: {} }];
  const users: any[] = [{ id: 'U-1', email: 'boss@x.com', roleKey: 'admin', tier: 'internal' }];
  const repo = (rows: any[], key: string) => ({
    find: async () => rows, findOneBy: async (w: any) => rows.find((r) => r[key] === w[key]) || null, create: (x: any) => x,
    save: async (x: any) => { const i = rows.findIndex((r) => r[key] === x[key]); if (i >= 0) rows[i] = x; else rows.push(x); return x; },
    update: async (w: any, p: any) => { const r = rows.find((x) => x[key] === w[key]); if (r) Object.assign(r, p); },
  });
  const sent: string[] = [];
  const auth = { sendInvite: async (u: any) => { sent.push(u.email); return { sent: true }; } };
  const settings: any[] = [];
  return { svc: new AccessImportService(repo(roles, 'key') as any, repo(users, 'id') as any, auth as any, repo(settings, 'key') as any), roles, users, sent, settings };
};

describe('access matrix import', () => {
  it('previews without changing anything; the executive maps onto Administrator', async () => {
    const { svc, roles, users } = setup();
    const r: any = await svc.importMatrix(SHEET, { dryRun: true });
    expect(r.applied).toBe(false);
    expect(r.roles.map((x: any) => [x.sheetKey, x.action])).toEqual([['r_internal_executive', 'keep_admin'], ['r_internal_project_manager', 'create'], ['r_client_open_book', 'create']]);
    expect(r.users).toEqual([
      expect.objectContaining({ email: 'boss@x.com', action: 'keep', note: 'stays an Administrator' }),
      expect.objectContaining({ email: 'pm@x.com', action: 'create', alsoIn: ['Client Open Book'] }),
    ]);
    expect(roles).toHaveLength(1);
    expect(users).toHaveLength(1);
  });

  it('applies: creates the roles with levels, creates and invites new accounts', async () => {
    const { svc, roles, users, sent } = setup();
    const r: any = await svc.importMatrix(SHEET, { dryRun: false });
    expect(r.applied).toBe(true);
    const pm = roles.find((x) => x.key === 'r_internal_project_manager');
    expect(pm.permissions.rfis).toMatchObject({ level: 'block', view: false });
    expect(pm.permissions.dashboard).toMatchObject({ level: 'modify', extent: 'assigned', manage: true });
    expect(roles.find((x) => x.key === 'r_client_open_book').tier).toBe('client');
    expect(users.find((u) => u.email === 'pm@x.com')).toMatchObject({ roleKey: 'r_internal_project_manager', tier: 'internal', status: 'pending' });
    expect(users.find((u) => u.email === 'boss@x.com').roleKey).toBe('admin');
    expect(sent).toEqual(['pm@x.com']);
  });

  it('can skip invites, and keeps a person’s own access changes clean', async () => {
    const { svc, users, sent } = setup();
    await svc.importMatrix(SHEET, { dryRun: false, invite: false });
    expect(sent).toEqual([]);
    const id = users.find((u) => u.email === 'pm@x.com').id;
    const r = await svc.setOverrides(id, { rfis: { level: 'view' }, bad: { level: 'god' }, dashboard: { extent: 'portfolio' } });
    expect(r.overrides).toEqual({ rfis: { level: 'view' }, dashboard: { extent: 'portfolio' } });
  });

  it('applies the built-in access sheet once, with no emails, and never touches the administrator', async () => {
    const { svc, roles, users, sent, settings } = setup();
    users[0].email = 'edward@origamidb.com';
    await svc.applyDefault();
    expect(roles.length).toBe(25); // admin + the sheet's 24 other roles
    expect(roles.find((r) => r.key === 'admin').permissions).toEqual({});
    expect(roles.find((r) => r.key === 'r_internal_project_manager').permissions.__overall).toMatchObject({ level: 'modify', extent: 'assigned' });
    expect(users.find((u) => u.email === 'edward@origamidb.com').roleKey).toBe('admin');
    expect(users.find((u) => u.email === 'labor@origamidb.com')).toMatchObject({ roleKey: 'r_internal_labor', status: 'pending' });
    expect(sent).toEqual([]);
    expect(settings.map((s) => s.key)).toEqual(['roles.accessMatrix.v1']);
    const before = roles.length + users.length;
    roles.find((r) => r.key === 'r_internal_labor').name = 'Renamed';
    expect(await svc.applyDefault()).toBeNull();
    expect(roles.length + users.length).toBe(before);
    expect(roles.find((r) => r.key === 'r_internal_labor').name).toBe('Renamed');
  });
});
