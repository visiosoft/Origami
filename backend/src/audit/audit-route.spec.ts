import { bodyChanges, describeRequest, diffFields, labelOf, projectOf } from './audit-route';

describe('audit log: what a request did', () => {
  it('names the record and action', () => {
    expect(describeRequest('PUT', '/api/projects/12')).toMatchObject({ entityType: 'Project', entityId: '12', action: 'updated' });
    expect(describeRequest('POST', '/api/projects')).toMatchObject({ entityType: 'Project', entityId: null, action: 'created' });
    expect(describeRequest('DELETE', '/api/people/7')).toMatchObject({ entityType: 'Contact', entityId: '7', action: 'deleted' });
    expect(describeRequest('PUT', '/api/pipeline/D-123/stage')).toMatchObject({ entityType: 'Deal', entityId: 'D-123', action: 'stage' });
    expect(describeRequest('PUT', '/api/roles/project_manager')).toMatchObject({ entityType: 'Role', entityId: 'project_manager', action: 'updated' });
    expect(describeRequest('PUT', '/api/project-tasks/reorder')).toMatchObject({ entityType: 'Task', entityId: null, action: 'reorder' });
    expect(describeRequest('DELETE', '/api/tasks/T-1/attachments/a9')).toMatchObject({ entityType: 'Request Log task', entityId: 'T-1', action: 'removed attachments' });
    expect(describeRequest('PUT', '/api/settings/email.brand?x=1')).toMatchObject({ entityType: 'Settings', action: 'updated' });
  });
  it('skips reads, sign-in, housekeeping and Finance (which logs itself)', () => {
    expect(describeRequest('GET', '/api/projects/1')).toBeNull();
    expect(describeRequest('POST', '/api/auth/login')).toBeNull();
    expect(describeRequest('PUT', '/api/views/tasks.board')).toBeNull();
    expect(describeRequest('POST', '/api/notifications/read')).toBeNull();
    expect(describeRequest('POST', '/api/finance-invoices/9/send')).toBeNull();
  });
  it('diffs fields, masks secrets and leaves out noise', () => {
    const d = diffFields({ name: 'A', stage: 'Design', passwordHash: 'x', updatedAt: '1', notes: null }, { name: 'A', stage: 'Construction', passwordHash: 'y', updatedAt: '2', notes: '' });
    expect(d).toEqual([{ field: 'stage', from: 'Design', to: 'Construction' }, { field: 'passwordHash', from: '•••', to: '•••' }]);
    expect(diffFields(null, { name: 'New' })).toEqual([{ field: 'name', from: null, to: 'New' }]);
    expect(diffFields({ scope: 'x'.repeat(500) }, { scope: 'y' })[0].from!.length).toBe(240);
  });
  it('body changes for records it does not diff', () => {
    expect(bodyChanges({ value: { a: 1 }, apiKey: 'sk-1' })).toEqual([{ field: 'value', from: null, to: '{"a":1}' }, { field: 'apiKey', from: null, to: '•••' }]);
    expect(bodyChanges([1, 2])).toEqual([]);
  });
  it('labels and projects', () => {
    expect(labelOf({ serial: 'T-2026-0001', title: 'Order windows' })).toBe('T-2026-0001 · Order windows');
    expect(labelOf({ name: 'Narvaes' })).toBe('Narvaes');
    expect(projectOf('projects', { id: 4 })).toBe(4);
    expect(projectOf('project-tasks', { projectId: 9 })).toBe(9);
    expect(projectOf('people', { id: 3 })).toBeNull();
  });
});
