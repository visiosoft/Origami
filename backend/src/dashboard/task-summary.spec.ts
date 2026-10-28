import { taskSummary } from './task-summary';

describe('Dashboard task summary', () => {
  const today = '2026-10-28';
  const board = [
    { id: 'B1', title: 'Order tile', projectId: 3, assigneeId: 'U-1', assignee: 'Edward', dueDate: '2026-10-20', status: 'Assigned', updatedAt: '2026-10-27' },
    { id: 'B2', title: 'Pour slab', projectId: 3, assignee: 'Kai', dueDate: today, status: 'In progress' },
    { id: 'B3', title: 'Done thing', projectId: 4, assigneeId: 'U-1', completed: true, status: 'Done', dueDate: '2026-10-01' },
  ];
  const log = [
    { id: 'L1', subject: 'Call back', assignedToId: 'U-1', status: 'Assigned', dueDate: '2026-10-29', updatedAt: '2026-10-28' },
    { id: 'L2', description: 'Closed item\nmore', assignedTo: 'Kai', status: 'Confirmed', dueDate: '2026-10-01' },
  ];
  const s = taskSummary(board, log, { id: 'U-1', name: 'Edward' }, {
    today, projectName: (id) => (id == null ? 'General Tasks' : `P${id}`), logClosed: (st) => st === 'Confirmed',
  });

  it('lists what is due or overdue, overdue first', () => {
    expect(s.attention.map((a) => a.task)).toEqual(['Order tile', 'Pour slab']);
  });
  it('counts my tasks and lists my latest open ones', () => {
    expect(s.mine).toMatchObject({ total: 3, open: 2, overdue: 1, today: 0 });
    expect(s.mine.latest.map((t) => t.key)).toEqual(['lL1', 'bB1']);
  });
  it('tallies the team and the projects with overdue tasks', () => {
    expect(s.team).toEqual([{ name: 'Edward', open: 1, done: 0 }, { name: 'Kai', open: 1, done: 1 }]);
    expect(s.overdueByProject).toEqual([[3, 1]]);
  });
});
