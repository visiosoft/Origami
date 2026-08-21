import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTaskEntity, TaskEntity, UserEntity, ProjectEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { reminderEmail, type ReminderBuckets, type ReminderTask } from './reminder.templates';

const DAY = 86400000;

@Injectable()
export class RemindersService {
  private readonly log = new Logger('RemindersService');

  constructor(
    @InjectRepository(ProjectTaskEntity) private readonly projectTasks: Repository<ProjectTaskEntity>,
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
  ) {}

  /**
   * Fires hourly and sends at most once per day, at the configured local hour.
   *
   * An hourly tick plus a date guard is used rather than a dynamic cron so the
   * send time stays editable in Settings without re-registering the job. The
   * `reminders.lastRunDate` key doubles as a lock, so a second App Service
   * instance cannot send everyone a duplicate digest.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async tick() {
    try {
      if ((await this.settings.get('reminders.enabled')) !== 'true') return;

      const timezone = (await this.settings.get('reminders.timezone')) || 'Asia/Dubai';
      const hour = parseInt((await this.settings.get('reminders.hour')) || '7', 10);
      const now = this.localParts(timezone);
      if (now.hour !== hour) return;
      if ((await this.settings.get('reminders.lastRunDate')) === now.date) return;

      // Claim the day before sending — cheap distributed lock.
      await this.settings.set('reminders.lastRunDate', now.date);
      await this.run();
    } catch (err) {
      this.log.error('Reminder tick failed: ' + (err as Error).message);
    }
  }

  /** The local date and hour in a given IANA timezone. */
  private localParts(timezone: string) {
    let date: string;
    let hour: number;
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
      });
      const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
      date = `${parts.year}-${parts.month}-${parts.day}`;
      hour = parseInt(parts.hour, 10);
    } catch {
      const d = new Date();
      date = d.toISOString().slice(0, 10);
      hour = d.getUTCHours();
    }
    return { date, hour };
  }

  /** Build and send every user's digest. Returns a per-user summary. */
  async run(): Promise<{ sent: number; skipped: number; recipients: string[] }> {
    if (!(await this.google.isConnected())) {
      this.log.warn('Reminders skipped — no Google account connected.');
      return { sent: 0, skipped: 0, recipients: [] };
    }

    const [boardTasks, logTasks, users, projects] = await Promise.all([
      this.projectTasks.find(),
      this.tasks.find(),
      this.users.find(),
      this.projects.find(),
    ]);
    const projectName = new Map(projects.map((p) => [Number(p.id), p.name]));
    const base = await this.settings.baseUrl();

    let sent = 0;
    let skipped = 0;
    const recipients: string[] = [];

    for (const user of users) {
      if (!user.email || user.status === 'suspended') { skipped++; continue; }

      const mine: ReminderTask[] = [
        ...boardTasks
          .filter((t) => this.isMine(t.assigneeId, t.assignee, user) && !t.completed && t.status !== 'Done' && !t.parentId)
          .map((t) => ({
            id: t.id, title: t.title, dueDate: t.dueDate || '',
            project: projectName.get(Number(t.projectId)) || `Project ${t.projectId}`,
            where: 'board' as const,
          })),
        ...logTasks
          .filter((t) => this.isMine(t.assignedToId, t.assignedTo, user) && t.status !== 'Closed')
          .map((t) => ({
            id: t.id, title: t.description?.slice(0, 90) || t.id, dueDate: t.dueDate || '',
            project: t.project || '', where: 'log' as const,
          })),
      ].filter((t) => !!t.dueDate);

      const buckets = this.bucket(mine);
      if (!buckets.overdue.length && !buckets.today.length && !buckets.soon.length) { skipped++; continue; }

      const mail = reminderEmail({ name: user.name, buckets, url: `${base}/tasks` });
      try {
        await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html });
        sent++;
        recipients.push(user.email);
      } catch (err) {
        this.log.warn(`Reminder to ${user.email} failed: ${(err as Error).message}`);
      }
    }

    this.log.log(`Reminders sent to ${sent} user(s), ${skipped} skipped`);
    return { sent, skipped, recipients };
  }

  /** Prefer the user id; fall back to the display name for un-backfilled rows. */
  private isMine(assigneeId: string | undefined, assignee: string | undefined, user: UserEntity) {
    if (assigneeId) return assigneeId === user.id;
    return !!assignee && assignee.trim().toLowerCase() === user.name.trim().toLowerCase();
  }

  private bucket(tasks: ReminderTask[]): ReminderBuckets {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    const out: ReminderBuckets = { overdue: [], today: [], soon: [] };
    for (const task of tasks) {
      const due = Date.parse(task.dueDate);
      if (Number.isNaN(due)) continue;
      if (due < todayMs) out.overdue.push(task);
      else if (due < todayMs + DAY) out.today.push(task);
      else if (due < todayMs + 3 * DAY) out.soon.push(task);
    }
    const byDate = (a: ReminderTask, b: ReminderTask) => a.dueDate.localeCompare(b.dueDate);
    out.overdue.sort(byDate); out.today.sort(byDate); out.soon.sort(byDate);
    return out;
  }
}
