import { ProjectAuditController } from './project-audit.controller';

describe('a project audit trail', () => {
  it('lists the project’s changes without finance entries', async () => {
    const audit: any = { list: jest.fn().mockResolvedValue([{ id: 'a', source: 'app' }, { id: 'f', source: 'finance' }]) };
    const c = new ProjectAuditController(audit);
    expect(await c.list('7')).toEqual([{ id: 'a', source: 'app' }]);
    expect(audit.list).toHaveBeenCalledWith({ projectId: '7', limit: '200' });
    expect(await c.list('abc')).toEqual([]);
  });
});
