import { describe, expect, it } from 'vitest';
import { addBusinessDays, dueForPriority, linkPriorityDue, priorityForDue } from './priority';

const FRI = '2026-10-16'; // a Friday

describe('priority and due date', () => {
  it('gives each priority its default due date', () => {
    expect(dueForPriority('Urgent', FRI)).toBe('2026-10-17');
    expect(dueForPriority('High', FRI)).toBe('2026-10-23'); // 5 business days, skipping the weekend
    expect(dueForPriority('Medium', FRI)).toBe('2026-10-30');
    expect(dueForPriority('Low', FRI)).toBe('2026-11-16');
    expect(dueForPriority('', FRI)).toBe('');
    expect(addBusinessDays(new Date('2026-10-16T12:00:00'), 1).getDate()).toBe(19);
  });

  it('reads a priority from a due date', () => {
    expect(priorityForDue('2026-10-16', FRI)).toBe('Urgent');
    expect(priorityForDue('2026-10-17', FRI)).toBe('Urgent');
    expect(priorityForDue('2026-10-22', FRI)).toBe('High');
    expect(priorityForDue('2026-11-10', FRI)).toBe('Medium');
    expect(priorityForDue('2026-12-01', FRI)).toBe('Low');
  });

  it('fills the other one in, but never overwrites what was typed', () => {
    let s = linkPriorityDue({}, { priority: 'High' }, FRI);
    expect(s).toEqual({ priority: 'High', dueDate: '2026-10-23', auto: 'due' });
    s = linkPriorityDue(s, { priority: 'Urgent' }, FRI); // the date was automatic, so it follows
    expect(s.dueDate).toBe('2026-10-17');
    s = linkPriorityDue(s, { dueDate: '2026-11-03' }, FRI); // typed by hand: priority stays as chosen
    expect(s).toEqual({ priority: 'Urgent', dueDate: '2026-11-03', auto: null });
    s = linkPriorityDue(s, { priority: 'Low' }, FRI);
    expect(s.dueDate).toBe('2026-11-03');
    const d = linkPriorityDue({}, { dueDate: '2026-10-20' }, FRI);
    expect(d).toEqual({ priority: 'High', dueDate: '2026-10-20', auto: 'priority' });
  });
});
