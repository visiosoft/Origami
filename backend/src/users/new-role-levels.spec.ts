import { RolesService } from './roles.service';

describe('Nov 27: a new role uses access levels', () => {
  it('starts on Block (assigned projects) unless permissions are given', async () => {
    const svc = Object.create(RolesService.prototype) as any;
    svc.repo = { create: (x: any) => x, save: async (x: any) => x };
    const r = await svc.create({ name: 'Test three', tier: 'internal' });
    expect(r.permissions.__overall).toMatchObject({ level: 'block', extent: 'assigned', view: false });
    const kept = await svc.create({ name: 'Copy', tier: 'internal', permissions: { rfis: { view: true, manage: true, level: 'modify' } } });
    expect(Object.keys(kept.permissions)).toEqual(['rfis']);
  });
});
