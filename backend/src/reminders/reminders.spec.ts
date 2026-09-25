import { addDays, bucketTasks, isoDue, wantsDigest } from './reminders.service';
import { reminderEmail, prettyDate, type ReminderTask } from './reminder.templates';

const task = (id: string, dueDate: string, extra: Partial<ReminderTask> = {}): ReminderTask =>
  ({ id, title: `Task ${id}`, dueDate, project: 'Aquino', where: 'board', ...extra });

describe('reminder digest', () => {
  it('buckets against the office date, not the server clock', () => {
    const b = bucketTasks([
      task('late', '2026-09-24'), task('now', '2026-09-25'), task('tmrw', '2026-09-26'),
      task('in2', '2026-09-27'), task('in3', '2026-09-28'), task('bad', 'someday'),
    ], '2026-09-25');
    expect(b.overdue.map((t) => t.id)).toEqual(['late']);
    expect(b.today.map((t) => t.id)).toEqual(['now']);
    expect(b.soon.map((t) => t.id)).toEqual(['tmrw', 'in2']);
  });

  it('accepts a full timestamp as a due date', () => {
    expect(bucketTasks([task('ts', '2026-09-25T17:00:00.000Z')], '2026-09-25').today).toHaveLength(1);
  });

  it('reads an older "Apr 26" due date as this year', () => {
    expect(isoDue('Sep 17', '2026-09-25')).toBe('2026-09-17');
    expect(isoDue('Sept 5', '2026-09-25')).toBe('2026-09-05');
    expect(isoDue('soon', '2026-09-25')).toBe('');
  });

  it('adds days across a month end', () => {
    expect(addDays('2026-09-29', 3)).toBe('2026-10-02');
  });

  it('respects each person\'s choice: daily by default, weekly on Mondays, off, or no email at all', () => {
    const monday = '2026-09-28';
    const friday = '2026-09-25';
    expect(wantsDigest({ notifyByEmail: null, digestFrequency: null as any }, friday)).toBe(true);
    expect(wantsDigest({ notifyByEmail: null, digestFrequency: 'weekly' }, friday)).toBe(false);
    expect(wantsDigest({ notifyByEmail: null, digestFrequency: 'weekly' }, monday)).toBe(true);
    expect(wantsDigest({ notifyByEmail: null, digestFrequency: 'off' }, monday)).toBe(false);
    expect(wantsDigest({ notifyByEmail: false, digestFrequency: 'daily' }, monday)).toBe(false);
  });

  it('links each task and marks the ones you only collaborate on', () => {
    const brand = { companyName: 'Origami' } as any;
    const mail = reminderEmail({
      name: 'Astrid Rivas', url: 'https://x/tasks', brand,
      buckets: { overdue: [task('T-1', '2026-09-24', { url: 'https://x/tasks?task=T-1&project=23', following: true })], today: [], soon: [] },
    });
    expect(mail.subject).toContain('1 task is overdue');
    expect(mail.html).toContain('href="https://x/tasks?task=T-1&amp;project=23"');
    expect(mail.html).toContain('you collaborate on this');
    expect(mail.html).toContain(prettyDate('2026-09-24'));
    expect(prettyDate('2026-09-24')).toBe('Thu, Sep 24');
  });
});
