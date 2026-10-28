import { describe, expect, it } from 'vitest';
import { getLeadTime, type Task } from './tasks';

const task = (o: Partial<Task>) => ({ id: 'T-1', topicType: 'Task', status: 'Open', meetingDate: '2026-10-01', dueDate: '2026-10-15', daysOpen: 0, activity: [], ...o } as unknown as Task);

describe('Request Log lead time', () => {
  it('open days run from the meeting date to today', () => {
    const lt = getLeadTime(task({}), new Date('2026-10-21T12:00:00'));
    expect(lt).toMatchObject({ leadTime: 14, openDays: 20, variance: 6, label: '6 days over lead time' });
  });
  it('the due-date history is the recorded changes, newest first, with the original', () => {
    const lt = getLeadTime(task({ dueDate: '2026-10-22', activity: [
      { id: 'e1', type: 'field', field: 'dueDate', from: '2026-10-15', to: '2026-10-20', by: 'Kai', at: '2026-10-10T10:00:00Z' },
      { id: 'e2', type: 'field', field: 'dueDate', from: '2026-10-20', to: '2026-10-22', by: 'Amara', at: '2026-10-12T10:00:00Z' },
      { id: 'e3', type: 'field', field: 'priority', from: 'Low', to: 'High', by: 'Kai', at: '2026-10-12T10:00:00Z' },
    ] as any }), new Date('2026-10-21T12:00:00'));
    expect(lt.audit.map((a) => [a.what.split(' · ')[0], a.by, a.chip])).toEqual([
      ['Due date moved out 2 days', 'Amara', 'Extended'],
      ['Due date moved out 5 days', 'Kai', 'Extended'],
      ['Due date Oct 15, 2026', 'When the task was created', 'Original'],
    ]);
  });
  it('nothing made up when nothing changed', () => {
    expect(getLeadTime(task({ dueDate: '' })).audit).toEqual([]);
  });
});
