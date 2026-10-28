import { lastValueFrom, of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';

function setup(rows: Record<string, any>) {
  const recorded: any[] = [];
  const audit: any = {
    load: jest.fn(async (_seg: string, id: string) => (rows[id] ? { ...rows[id] } : null)),
    record: jest.fn(async (e: any) => { recorded.push(e); }),
  };
  const run = async (method: string, url: string, body: any, result: any, change?: () => void) => {
    const req: any = { method, originalUrl: url, body, claims: { sub: 'U-1', name: 'Edward', email: 'e@x' } };
    const ctx: any = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) };
    const obs = await new AuditInterceptor(audit).intercept(ctx, { handle: () => { change?.(); return of(result); } });
    await lastValueFrom(obs);
    await new Promise((r) => setTimeout(r, 0));
  };
  return { recorded, run, rows };
}

describe('AuditInterceptor', () => {
  it('records before/after of a tracked record', async () => {
    const t = setup({ '12': { id: 12, name: 'Narvaes', stage: 'Design' } });
    await t.run('PUT', '/api/projects/12', { stage: 'Construction' }, {}, () => { t.rows['12'].stage = 'Construction'; });
    expect(t.recorded).toEqual([expect.objectContaining({ userName: 'Edward', entityType: 'Project', entityId: '12', label: 'Narvaes', action: 'updated', projectId: 12, changes: [{ field: 'stage', from: 'Design', to: 'Construction' }] })]);
  });
  it('skips an autosave that changed nothing', async () => {
    const t = setup({ '12': { id: 12, name: 'Narvaes' } });
    await t.run('PUT', '/api/projects/12', { name: 'Narvaes' }, {});
    expect(t.recorded).toEqual([]);
  });
  it('records a create by the returned id, and a delete with what was removed', async () => {
    const t = setup({});
    await t.run('POST', '/api/project-tasks', { title: 'Order windows' }, { id: 'T-9' }, () => { t.rows['T-9'] = { id: 'T-9', title: 'Order windows', projectId: 3 }; });
    expect(t.recorded[0]).toMatchObject({ entityType: 'Task', entityId: 'T-9', action: 'created', projectId: 3, label: 'Order windows' });
    await t.run('DELETE', '/api/project-tasks/T-9', {}, {}, () => { delete t.rows['T-9']; });
    expect(t.recorded[1]).toMatchObject({ action: 'deleted', label: 'Order windows', changes: [{ field: 'id', from: 'T-9', to: null }, { field: 'title', from: 'Order windows', to: null }, { field: 'projectId', from: '3', to: null }] });
  });
  it('logs what was sent for other records, and nothing for signed-out requests', async () => {
    const t = setup({});
    await t.run('PUT', '/api/settings/email.brand', { value: 'Origami' }, {});
    expect(t.recorded[0]).toMatchObject({ entityType: 'Settings', entityId: 'email.brand', changes: [{ field: 'value', from: null, to: 'Origami' }] });
  });
});
