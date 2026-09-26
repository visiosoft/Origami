import { ProjectTasksService } from './project-tasks.service';

const SECTIONS = [
  { id: 'S-todo', name: 'To Do' }, { id: 'S-prog', name: 'In Progress' }, { id: 'S-hold', name: 'On Hold' }, { id: 'S-done', name: 'Done' },
];
const service = new ProjectTasksService({} as any, {} as any, { forProject: async () => SECTIONS } as any, {} as any, {} as any);
const sync = (task: any, patch: any) => (service as any).syncHoldSection(task, patch).then(() => patch);

describe('an "On hold" column and the On hold status move together', () => {
  it('setting On hold files the task in the column', async () => {
    expect(await sync({ projectId: 23, sectionId: 'S-prog', status: 'In progress' }, { status: 'On hold' })).toEqual({ status: 'On hold', sectionId: 'S-hold' });
  });

  it('dragging into the column sets On hold; dragging out takes it off hold', async () => {
    expect(await sync({ projectId: 23, sectionId: 'S-todo', status: 'Not started' }, { sectionId: 'S-hold' })).toEqual({ sectionId: 'S-hold', status: 'On hold' });
    expect(await sync({ projectId: 23, sectionId: 'S-hold', status: 'On hold' }, { sectionId: 'S-todo' })).toEqual({ sectionId: 'S-todo', status: 'In progress' });
  });

  it('another status moves it back to the matching column', async () => {
    expect(await sync({ projectId: 23, sectionId: 'S-hold', status: 'On hold' }, { status: 'Done' })).toEqual({ status: 'Done', sectionId: 'S-done' });
  });

  it('a board without an "On hold" column is left alone', async () => {
    const plain = new ProjectTasksService({} as any, {} as any, { forProject: async () => SECTIONS.filter((s) => s.id !== 'S-hold') } as any, {} as any, {} as any);
    const patch = { status: 'On hold' };
    await (plain as any).syncHoldSection({ projectId: 23, sectionId: 'S-prog', status: 'In progress' }, patch);
    expect(patch).toEqual({ status: 'On hold' });
  });
});
