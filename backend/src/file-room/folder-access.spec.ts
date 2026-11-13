import { ForbiddenException } from '@nestjs/common';
import { covers, folderOpen } from './folder-access';
import { FolderAccessService } from './folder-access.service';

const staff = { sub: 'U-S', roleKey: 'project_manager', staff: true, companies: [], manager: false };
const sub = { sub: 'U-B', roleKey: 'r_subcontractor', staff: false, companies: ['bay concrete'], manager: false };
const client = { sub: 'U-K', roleKey: 'r_client_closed_book', staff: false, companies: [], manager: false };
const manager = { ...client, manager: true };

describe('restricted File Room folders (Nov 13)', () => {
  const rules = [
    { projectId: 7, path: ['Contracts'], audience: 'internal' },
    { projectId: 7, path: ['Drawings', 'Structural'], audience: 'picked', people: [{ type: 'company', id: 'Bay Concrete' }, { type: 'user', id: 'U-K' }] },
  ];
  it('a rule covers its folder and everything inside it, case ignored', () => {
    expect(covers(['Drawings', 'Structural'], ['drawings', 'structural', 'Rev 2'])).toBe(true);
    expect(covers(['Drawings', 'Structural'], ['Drawings'])).toBe(false);
    expect(covers([], ['x'])).toBe(false);
  });
  it('staff only, picked people / companies, other projects untouched, managers always', () => {
    expect(folderOpen(rules, staff, 7, ['Contracts', 'Signed'])).toBe(true);
    expect(folderOpen(rules, client, 7, ['Contracts'])).toBe(false);
    expect(folderOpen(rules, client, 8, ['Contracts'])).toBe(true);
    expect(folderOpen(rules, sub, 7, ['Drawings', 'Structural', 'S-101.pdf'])).toBe(true);
    expect(folderOpen(rules, client, 7, ['Drawings', 'Structural'])).toBe(true);
    expect(folderOpen(rules, staff, 7, ['Drawings', 'Structural'])).toBe(false);
    expect(folderOpen(rules, staff, 7, ['Drawings', 'Architectural'])).toBe(true);
    expect(folderOpen(rules, manager, 7, ['Contracts'])).toBe(true);
  });

  function svc(rows: any[] = [], perms: any = {}) {
    const repo = { find: async (o?: any) => rows.filter((r) => !o?.where || r.projectId === o.where.projectId), findOne: async (o: any) => rows.find((r) => r.projectId === o.where.projectId && r.pathKey === o.where.pathKey) || null, create: (x: any) => ({ ...x }), save: async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; }, remove: async (x: any) => { rows.splice(rows.findIndex((r) => r.id === x.id), 1); } };
    const people = { find: async () => [{ userId: 'U-B', email: 'b@bay.test', company: 'Bay Concrete' }] };
    const access = { permissions: async () => perms, isStaff: (c: any) => c.tier === 'internal' };
    return { s: new FolderAccessService(repo as any, people as any, access as any), rows };
  }
  it('setting, opening to everyone again, and the check on one file', async () => {
    const { s, rows } = svc();
    await expect(s.set(7, { path: [], audience: 'internal' }, { name: 'E' })).rejects.toThrow(/Pick a folder/);
    await expect(s.set(7, { path: ['Drawings'], audience: 'picked', people: [] }, { name: 'E' })).rejects.toThrow(/Pick who/);
    await s.set(7, { path: ['Drawings', 'Structural'], audience: 'picked', people: [{ type: 'company', id: 'Bay Concrete', name: 'Bay Concrete' }] }, { name: 'E' });
    expect(rows).toHaveLength(1);
    const subClaims: any = { sub: 'U-B', email: 'b@bay.test', roleKey: 'r_subcontractor', tier: 'consultant' };
    const pm: any = { sub: 'U-P', email: 'p@o.test', roleKey: 'project_manager', tier: 'internal' };
    await expect(s.assertFile(subClaims, { projectId: 7, folderPath: ['Drawings', 'Structural'] })).resolves.toBeUndefined();
    await expect(s.assertFile(pm, { projectId: 7, folderPath: ['Drawings', 'Structural'] })).rejects.toBeInstanceOf(ForbiddenException);
    expect((await s.gate(pm))(7, ['Drawings'])).toBe(true);
    await s.set(7, { path: ['Drawings', 'Structural'], audience: 'everyone' }, { name: 'E' });
    expect(rows).toHaveLength(0);
    await expect(s.assertFile(pm, { projectId: 7, folderPath: ['Drawings', 'Structural'] })).resolves.toBeUndefined();
  });
  it('File Room managers and admins see restricted folders', async () => {
    const { s } = svc([{ id: 'R', projectId: 7, pathKey: 'Contracts', path: ['Contracts'], audience: 'internal', people: null }], { planroom: { manage: true } });
    expect((await s.gate({ sub: 'U-K', roleKey: 'r_client_closed_book', tier: 'client' } as any))(7, ['Contracts'])).toBe(true);
  });
});
