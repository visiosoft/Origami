import { scopeTasks } from './viewer.util';

/** Nov 17: does a collaborator on a subtask see it, and its parent? */
describe('subtask visibility for outside accounts', () => {
  const client = { sub: 'C1', name: 'Cara', roleKey: 'client', tier: 'client' } as any;
  const staff = { sub: 'S1', name: 'Sam', roleKey: 'pm', tier: 'internal' } as any;
  const tasks = [
    { id: 'P1', title: 'Parent', projectId: 1, description: 'secret', collaborators: [] },
    { id: 'C1a', title: 'Child on me', projectId: 1, parentId: 'P1', collaborators: [{ id: 'C1', name: 'Cara' }] },
    { id: 'C1b', title: 'Sibling', projectId: 1, parentId: 'P1', collaborators: [] },
    { id: 'P2', title: 'Parent on me', projectId: 1, collaborators: [{ id: 'C1', name: 'Cara' }] },
    { id: 'C2a', title: 'Its child', projectId: 1, parentId: 'P2', collaborators: [] },
    { id: 'C2b', title: 'Internal child', projectId: 1, parentId: 'P2', tags: ['internal'], collaborators: [] },
    { id: 'X', title: 'Other', projectId: 1, collaborators: [] },
  ];

  it('a collaborator on a subtask sees it, and only the title of its parent', () => {
    const out = scopeTasks(tasks, client);
    expect(out.find((t: any) => t.id === 'C1a')).toBeTruthy();
    const parent: any = out.find((t: any) => t.id === 'P1');
    expect(parent).toMatchObject({ title: 'Parent', contextOnly: true });
    expect(parent.description).toBeUndefined();
    expect(out.find((t: any) => t.id === 'C1b')).toBeUndefined();
  });
  it('a collaborator on a parent sees its subtasks, not internal ones', () => {
    const ids = scopeTasks(tasks, client).map((t: any) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['P2', 'C2a']));
    expect(ids).not.toContain('C2b');
    expect(ids).not.toContain('X');
  });
  it('staff see everything, unchanged', () => {
    expect(scopeTasks(tasks, staff)).toHaveLength(tasks.length);
  });
});
