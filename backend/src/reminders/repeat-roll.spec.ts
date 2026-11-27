import { RemindersService } from './reminders.service';

describe('Nov 27: a missed repeating task moves on to today', () => {
  it('rolls open repeating tasks forward; leaves done, archived and one-off tasks alone', async () => {
    const board: any[] = [
      { id: 'B1', dueDate: '2026-11-24', repeat: { every: 'day' }, status: 'In progress' },
      { id: 'B2', dueDate: '2026-11-24', repeat: { every: 'weekdays' }, status: 'Not started' },
      { id: 'B3', dueDate: '2026-11-24', repeat: { every: 'day' }, status: 'Done', completed: true },
      { id: 'B4', dueDate: '2026-11-24', repeat: null, status: 'In progress' },
    ];
    const log: any[] = [{ id: 'L1', dueDate: '2026-11-20', repeat: { every: 'week', days: [1] }, status: 'In Progress' }];
    const svc = Object.create(RemindersService.prototype) as any;
    svc.settings = { get: async () => null, set: async () => undefined };
    svc.projectTasks = { find: async () => board, save: async (x: any) => x };
    svc.tasks = { find: async () => log, save: async (x: any) => x };
    // 2026-11-28 is a Saturday.
    expect(await svc.rollRepeats('2026-11-28')).toEqual({ moved: 3 });
    expect(board.map((t) => t.dueDate)).toEqual(['2026-11-28', '2026-11-30', '2026-11-24', '2026-11-24']);
    expect(log[0].dueDate).toBe('2026-11-30');
  });
});
