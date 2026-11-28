import { MeetingsService } from './meetings.service';
import { ProjectAccessService } from '../auth/project-access.service';
import { meetingFromEvent } from './calendar-sync';

/** Nov 27 (Weekly Sync): meeting tasks go on the board; open ones already in the log move there (preview, then Apply). */
describe('meeting tasks on the board', () => {
  const setup = () => {
    const meetings: any[] = [{ id: 'M1', title: 'Weekly Sync', date: '2026-11-27', time: '10:00', project: 'HŌM Cafe', projectId: 7, status: 'reviewed' }];
    const tasks: any[] = [];
    const board: any[] = [];
    const repo = { create: (r: any) => r, save: async (r: any) => r, findOneBy: async (w: any) => meetings.find((m) => m.id === w.id) || null, find: async () => meetings, findBy: async () => meetings };
    const tasksRepo = { find: async (o: any = {}) => tasks.filter((t) => (!o.where?.meetingId || t.meetingId === o.where.meetingId) && (!o.where?.topicType || t.topicType === o.where.topicType)), save: async (t: any) => t, update: async () => undefined };
    const tasksSvc = {
      create: async (dto: any) => { const t = { id: 'L' + (tasks.length + 1), status: 'Open', ...dto }; tasks.push(t); return t; },
      statuses: async () => [{ name: 'Open' }, { name: 'Closed', closed: true }],
    };
    const boardSvc = { create: async (dto: any) => { const t = { id: 'B' + (board.length + 1), serial: 'T-2026-000' + (board.length + 1), status: dto.assignee ? 'Assigned' : 'Not started', completed: false, activity: [], ...dto }; board.push(t); return t; } };
    const sections = { forProject: async () => [{ id: 'S-todo', name: 'To Do' }, { id: 'S-ns', name: 'Not started' }] };
    const boardRepo = { find: async (o: any = {}) => board.filter((t) => !o.where?.meetingId || t.meetingId === o.where.meetingId || o.where.meetingId?._value?.includes?.(t.meetingId)), findOneBy: async (w: any) => board.find((t) => t.id === w.id), save: async (t: any) => t, update: async () => undefined };
    const projects = [{ id: 7, name: 'HŌM Cafe' }, { id: 9, name: '1311 Countryside Ct' }];
    const projectsRepo = { findOneBy: async (w: any) => projects.find((p) => p.id === w.id) || null, find: async () => projects };
    const svc = new MeetingsService(repo as any, tasksRepo as any, tasksSvc as any, { find: async () => [] } as any, { find: async () => [] } as any, boardSvc as any, sections as any, boardRepo as any, projectsRepo as any);
    return { svc, meetings, tasks, board };
  };

  it('a Task goes on the board of the item’s project (or General); FYI stays FOR RECORD; no duplicates', async () => {
    const { svc, tasks, board } = setup();
    const a = await svc.addAction('M1', { topicType: 'Task', subject: 'Order the hood', assignedTo: 'Jerrod', assignedToId: 'U-J', dueDate: '2026-12-01' } as any, { name: 'Astrid' } as any);
    expect(a).toMatchObject({ board: true, projectName: 'HŌM Cafe' });
    expect(board[0]).toMatchObject({ projectId: 7, sectionId: 'S-todo', title: 'Order the hood', meetingId: 'M1', sourceType: 'meeting', sourceLabel: 'Weekly Sync - 2026/11/27 10:00' });
    await svc.addAction('M1', { topicType: 'Task', subject: 'Send subcontract example', projectId: 9, project: '1311 Countryside Ct' } as any, { name: 'Astrid' } as any);
    await svc.addAction('M1', { topicType: 'Task', subject: 'Book the office cleaning', projectId: null, project: '' } as any, { name: 'Astrid' } as any);
    expect(board.map((t) => t.projectId)).toEqual([7, 9, null]);
    expect(await svc.addAction('M1', { topicType: 'Task', subject: 'order the HOOD.' } as any, { name: 'B' } as any)).toMatchObject({ duplicate: true, board: true });
    await svc.addAction('M1', { topicType: 'FYI', subject: 'City inspection passed' } as any, { name: 'Astrid' } as any);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ topicType: 'FYI', project: 'HŌM Cafe', meetingId: 'M1' });
    expect(board).toHaveLength(3);
  });

  it('a meeting stays open while its board tasks are open', async () => {
    const { svc, meetings, board } = setup();
    meetings[0].status = 'complete';
    board.push({ id: 'B9', meetingId: 'M1', status: 'Assigned', completed: false });
    await svc.settle(meetings);
    expect(meetings[0].status).not.toBe('complete');
  });

  it('moves open meeting Tasks from the log to the board: preview, then Apply; a second run finds none', async () => {
    const { svc, tasks, board } = setup();
    tasks.push(
      { id: 'L1', serial: 'T-2026-0010', topicType: 'Task', subject: 'Order tile', status: 'Open', meetingId: 'M1', project: 'HŌM Cafe', assignedTo: 'Jerrod', assignedToId: 'U-J', dueDate: '2026-12-02', comments: [{ id: 'c1', text: 'Waiting on quote' }], attachments: [{ id: 'a1', name: 'quote.pdf', kind: 'drive', driveId: 'D1' }], activity: [] },
      { id: 'L2', topicType: 'Task', subject: 'Done already', status: 'Closed', meetingId: 'M1', project: 'HŌM Cafe' },
      { id: 'L3', topicType: 'FYI', subject: 'Note', status: 'Open', meetingId: 'M1', project: 'HŌM Cafe' },
      { id: 'L4', topicType: 'Task', subject: 'Not from a meeting', status: 'Open', project: 'HŌM Cafe' },
      { id: 'L5', topicType: 'Task', subject: 'Unknown project', status: 'Open', meetingId: 'M1', project: 'Nowhere' },
    );
    const plan = await svc.moveToBoardPlan(false);
    expect(plan).toMatchObject({ applied: false, count: 2 });
    expect(plan.rows!.map((r: any) => [r.id, r.projectName])).toEqual([['L1', 'HŌM Cafe'], ['L5', 'General']]);
    expect(board).toHaveLength(0);
    const done = await svc.moveToBoardPlan(true, { name: 'Edward' } as any);
    expect(done).toMatchObject({ applied: true, count: 2 });
    expect(board[0]).toMatchObject({ projectId: 7, title: 'Order tile', assigneeId: 'U-J', dueDate: '2026-12-02', meetingId: 'M1', comments: [{ id: 'c1' }], attachments: [{ id: 'a1' }] });
    const l1 = tasks.find((t) => t.id === 'L1');
    expect(l1).toMatchObject({ status: 'Closed' });
    expect(l1.closedAt).toBeTruthy();
    expect(l1.activity.at(-1).text).toBe('Moved to the board → T-2026-0001');
    expect((await svc.moveToBoardPlan(false)).count).toBe(0);
  });

  it('a board task given to you shows even on a project you aren’t on', async () => {
    const access = new ProjectAccessService({} as any, {} as any, {} as any, {} as any);
    (access as any).allowedIds = async () => new Set([7]);
    const rows: any[] = [{ id: 'a', projectId: 7 }, { id: 'b', projectId: 9, assigneeId: 'U-J' }, { id: 'c', projectId: 9 }, { id: 'd', projectId: 9, createdById: 'U-J' }, { id: 'e', projectId: 9, collaborators: [{ id: 'U-J' }] }];
    expect((await access.filterOrMine({ sub: 'U-J', name: 'Jerrod' } as any, rows, (r: any) => r.projectId)).map((r: any) => r.id)).toEqual(['a', 'b', 'd', 'e']);
  });

  it('calendar: People records name outside attendees, without making an outside organiser one of us', () => {
    const e: any = { id: 'E1', summary: 'OAC', start: { dateTime: '2026-11-28T18:00:00Z' }, end: { dateTime: '2026-11-28T19:00:00Z' }, organizer: { email: 'ann@arch.test' },
      attendees: [{ email: 'astrid@origamidb.com' }, { email: 'ann@arch.test' }, { email: 'x@else.test', displayName: 'X' }] };
    const m: any = meetingFromEvent(e, [{ id: 'U-A', name: 'Astrid', emails: ['astrid@origamidb.com'] }, { name: 'Ann Architect', emails: ['ann@arch.test'] }], [], 'origamidb.com');
    expect(m.attendees).toEqual([{ id: 'U-A', name: 'Astrid', email: 'astrid@origamidb.com' }, { name: 'Ann Architect', email: 'ann@arch.test' }, { name: 'X', email: 'x@else.test' }]);
    expect(m.type).toBe('Outside');
  });
});
