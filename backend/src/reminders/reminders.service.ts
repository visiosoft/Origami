import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTaskEntity, TaskEntity, UserEntity, ProjectEntity, ProjectPhaseEntity, RfiEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { reminderEmail, overdueEmail, progressEmail, overstretchEmail, type ReminderBuckets, type ReminderTask } from './reminder.templates';
import { loadEmailBrand } from '../email/shell';

const DAY = 86400000;
const HOUR = 3600000;
/** The office is in California; a workspace can change it under Settings -> Integrations. */
export const DEFAULT_REMINDER_TIMEZONE = 'America/Los_Angeles';

/** YYYY-MM-DD plus n days, in plain calendar arithmetic (no timezone drift). */
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** A due date as YYYY-MM-DD. Older Request Log rows say just "Apr 26" -- read as this year. */
export function isoDue(raw: string | null | undefined, today: string): string {
  const v = (raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})$/.exec(v);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month < 0) return '';
  return `${today.slice(0, 4)}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/**
 * Overdue / due today / due in the next 3 days, against the office's own
 * calendar date -- the server runs on UTC, so "today" must not come from it.
 */
export function bucketTasks(tasks: ReminderTask[], today: string): ReminderBuckets {
  const soonEnd = addDays(today, 3);
  const out: ReminderBuckets = { overdue: [], today: [], soon: [] };
  for (const task of tasks) {
    const due = isoDue(task.dueDate, today);
    if (!due) continue;
    if (due < today) out.overdue.push(task);
    else if (due === today) out.today.push(task);
    else if (due < soonEnd) out.soon.push(task);
  }
  const byDate = (a: ReminderTask, b: ReminderTask) => a.dueDate.localeCompare(b.dueDate);
  out.overdue.sort(byDate); out.today.sort(byDate); out.soon.sort(byDate);
  return out;
}

/**
 * Whether this person gets the digest today: email on, frequency not off, and
 * a weekly digest only on Mondays. Never chosen reads as daily.
 */
export function wantsDigest(user: Pick<UserEntity, 'notifyByEmail' | 'digestFrequency'>, today: string) {
  if (user.notifyByEmail === false) return false;
  const freq = user.digestFrequency || 'daily';
  if (freq === 'off') return false;
  if (freq === 'weekly') return new Date(`${today}T12:00:00Z`).getUTCDay() === 1;
  return true;
}

@Injectable()
export class RemindersService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('RemindersService');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ProjectTaskEntity) private readonly projectTasks: Repository<ProjectTaskEntity>,
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectPhaseEntity) private readonly phases: Repository<ProjectPhaseEntity>,
    @InjectRepository(RfiEntity) private readonly rfis: Repository<RfiEntity>,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
  ) {}

  /**
   * A plain hourly interval rather than a cron library — this app deliberately
   * carries no scheduler dependency, and adding one means a fresh `npm install`
   * on every container start.
   */
  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.tick(); }, HOUR);
    // A restart (every deploy) resets the hourly clock -- check once shortly
    // after boot too, so a restart just before the send hour doesn't skip a day.
    setTimeout(() => { void this.tick(); }, 60000).unref?.();
    // Don't hold the process open on shutdown.
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Runs hourly, sends at most once a day at the configured local hour.
   *
   * Checking the hour on each tick keeps the send time editable in Settings
   * without re-registering anything. The `reminders.lastRunDate` key doubles as
   * a lock, so a second App Service instance cannot double-send.
   */
  async tick() {
    try {
      if ((await this.settings.get('reminders.enabled')) !== 'true') return;

      const timezone = await this.timezone();
      const hour = parseInt((await this.settings.get('reminders.hour')) || '7', 10);
      const now = this.localParts(timezone);
      if (now.hour !== hour) return;
      if ((await this.settings.get('reminders.lastRunDate')) === now.date) return;

      // Claim the day before sending — cheap distributed lock.
      await this.settings.set('reminders.lastRunDate', now.date);
      await this.run(now.date);

      // Each of these is opt-in per user and keeps its own once-a-day lock
      // key, so one failing does not block the others or re-run the digest.
      await this.runOverdueOnly(now.date).catch((err) => this.log.error('Standalone overdue failed: ' + (err as Error).message));
      await this.runProgressChecks(now.date).catch((err) => this.log.error('Progress notices failed: ' + (err as Error).message));
      await this.runOverstretch(now.date).catch((err) => this.log.error('Overstretch check failed: ' + (err as Error).message));
    } catch (err) {
      this.log.error('Reminder tick failed: ' + (err as Error).message);
    }
  }

  private async timezone() {
    return (await this.settings.get('reminders.timezone')) || DEFAULT_REMINDER_TIMEZONE;
  }

  /** Everything one run needs, read once. */
  private async load() {
    const [boardTasks, logTasks, users, projects] = await Promise.all([
      this.projectTasks.find(), this.tasks.find(), this.users.find(), this.projects.find(),
    ]);
    // RFIs still waiting on an answer -- the owner chases them.
    const openRfis = await this.rfis.find({ where: { status: 'open' } }).catch(() => [] as RfiEntity[]);
    return { boardTasks, logTasks, users, openRfis, projectName: new Map(projects.map((p) => [Number(p.id), p.name])) };
  }

  /**
   * One person's open, dated tasks: the ones they own, plus the ones they
   * collaborate on (flagged, so the email can say so). Each links straight
   * to the task.
   */
  private tasksFor(user: UserEntity, data: Awaited<ReturnType<RemindersService['load']>>, base: string): ReminderTask[] {
    const following = (list: unknown) => Array.isArray(list) && list.some((c: any) => c?.id === user.id);
    const out: ReminderTask[] = [];
    for (const t of data.boardTasks) {
      if (t.completed || t.status === 'Done' || t.parentId || !t.dueDate) continue;
      const mine = this.isMine(t.assigneeId, t.assignee, user);
      if (!mine && !following(t.collaborators)) continue;
      out.push({
        id: t.id, title: t.title, dueDate: t.dueDate,
        project: data.projectName.get(Number(t.projectId)) || `Project ${t.projectId}`,
        where: 'board', following: !mine,
        url: `${base}/tasks?task=${encodeURIComponent(t.id)}&project=${t.projectId}`,
      });
    }
    for (const t of data.logTasks) {
      if (t.status === 'Closed' || !t.dueDate) continue;
      const mine = this.isMine(t.assignedToId, t.assignedTo, user);
      if (!mine && !following(t.collaborators)) continue;
      out.push({
        id: t.id, title: t.description?.slice(0, 90) || t.id, dueDate: t.dueDate,
        project: t.project || '', where: 'log', following: !mine,
        url: `${base}/tasks?task=${encodeURIComponent(t.id)}&type=log`,
      });
    }
    for (const r of data.openRfis) {
      if (r.ownerId !== user.id || !r.dateDue) continue;
      out.push({
        id: r.id, title: `${r.number}: ${r.subject} — awaiting answer${r.to?.name ? ` from ${r.to.name}` : ''}`, dueDate: r.dateDue,
        project: data.projectName.get(Number(r.projectId)) || `Project ${r.projectId}`, where: 'rfi',
        url: `${base}/rfis?rfi=${encodeURIComponent(r.id)}`,
      });
    }
    return out;
  }

  /**
   * Send one person their digest right now, whatever the schedule says --
   * "what would my reminder look like today?".
   */
  async sendMine(userId: string): Promise<{ sent: boolean; reason?: string; overdue: number; today: number; soon: number }> {
    const none = { overdue: 0, today: 0, soon: 0 };
    if (!(await this.google.isConnected())) return { sent: false, reason: 'no Google account is connected for sending mail', ...none };
    const data = await this.load();
    const user = data.users.find((u) => u.id === userId);
    if (!user?.email) return { sent: false, reason: 'your account has no email address', ...none };
    const today = this.localParts(await this.timezone()).date;
    const base = await this.settings.baseUrl();
    const buckets = bucketTasks(this.tasksFor(user, data, base), today);
    const counts = { overdue: buckets.overdue.length, today: buckets.today.length, soon: buckets.soon.length };
    if (!counts.overdue && !counts.today && !counts.soon) return { sent: false, reason: 'nothing of yours is overdue or due in the next 3 days', ...counts };
    const mail = reminderEmail({ name: user.name, buckets, url: `${base}/tasks`, brand: await loadEmailBrand(this.settings) });
    await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html });
    return { sent: true, ...counts };
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
  async run(today?: string): Promise<{ sent: number; skipped: number; recipients: string[] }> {
    if (!(await this.google.isConnected())) {
      this.log.warn('Reminders skipped — no Google account connected.');
      return { sent: 0, skipped: 0, recipients: [] };
    }

    const data = await this.load();
    const { boardTasks, users, projectName } = data;
    const date = today || this.localParts(await this.timezone()).date;
    const base = await this.settings.baseUrl();
    const brand = await loadEmailBrand(this.settings);

    let sent = 0;
    let skipped = 0;
    const recipients: string[] = [];

    for (const user of users) {
      if (!user.email || user.status === 'suspended' || !wantsDigest(user, date)) { skipped++; continue; }

      const buckets = bucketTasks(this.tasksFor(user, data, base), date);

      // Milestones are opt-in and separate from "mine" -- a milestone the
      // office wants everyone to see is still labelled on whoever holds the
      // task, so this stays scoped to the same assignee filter as the rest
      // of the digest, just with its own 21-day window and label gate.
      if (user.notifyOnMilestone === true) {
        const horizon = Date.now() + 21 * DAY;
        buckets.milestones = boardTasks
          .filter((t) => this.isMine(t.assigneeId, t.assignee, user) && !t.completed && t.status !== 'Done' && !t.parentId)
          .filter((t) => (t.labels || []).includes('Milestone') && t.dueDate)
          .filter((t) => { const due = Date.parse(t.dueDate); return !Number.isNaN(due) && due <= horizon; })
          .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate || '', project: projectName.get(Number(t.projectId)) || `Project ${t.projectId}`, where: 'board' as const, url: `${base}/tasks?task=${encodeURIComponent(t.id)}&project=${t.projectId}` }))
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      }

      if (!buckets.overdue.length && !buckets.today.length && !buckets.soon.length && !buckets.milestones?.length) { skipped++; continue; }

      const mail = reminderEmail({ name: user.name, buckets, url: `${base}/tasks`, brand });
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

  /**
   * A standalone overdue notice, separate from the daily digest.
   *
   * The digest already carries an overdue bucket for everyone; this is for a
   * user who wants overdue called out on its own rather than folded into the
   * bigger email. Opt-in (notifyOnOverdue === true) -- defaulting it on would
   * duplicate what the digest already sends. Own lock key so it runs once a
   * day independent of the digest's own lock.
   */
  private async runOverdueOnly(today: string) {
    if ((await this.settings.get('reminders.overdueLastRunDate')) === today) return;
    await this.settings.set('reminders.overdueLastRunDate', today);
    if (!(await this.google.isConnected())) return;

    const data = await this.load();
    const base = await this.settings.baseUrl();
    const brand = await loadEmailBrand(this.settings);

    for (const user of data.users) {
      if (!user.email || user.status === 'suspended' || user.notifyOnOverdue !== true || user.notifyByEmail === false) continue;
      const overdue = bucketTasks(this.tasksFor(user, data, base), today).overdue;
      if (!overdue.length) continue;
      const mail = overdueEmail({ name: user.name, tasks: overdue, url: `${base}/tasks`, brand });
      await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html })
        .catch((err) => this.log.warn(`Overdue notice to ${user.email} failed: ${(err as Error).message}`));
    }
  }

  /**
   * Fires once per phase per threshold (50/90/100%), stamped so it never
   * refires. Sent to every user opted into milestone notices -- there is no
   * per-project "owner" concept to target more narrowly yet, so this is
   * broader than ideal; narrowing it is a follow-up once that exists.
   */
  private async runProgressChecks(today: string) {
    if ((await this.settings.get('reminders.progressLastRunDate')) === today) return;
    await this.settings.set('reminders.progressLastRunDate', today);
    if (!(await this.google.isConnected())) return;

    const [phases, boardTasks, projects, users] = await Promise.all([
      this.phases.find(), this.projectTasks.find(), this.projects.find(), this.users.find(),
    ]);
    const projectName = new Map(projects.map((p) => [Number(p.id), p.name]));
    const base = await this.settings.baseUrl();
    const brand = await loadEmailBrand(this.settings);
    const recipients = users.filter((u) => u.email && u.status !== 'suspended' && u.notifyOnMilestone === true);
    if (!recipients.length) return;

    const toStamp: ProjectPhaseEntity[] = [];
    for (const phase of phases) {
      const own = boardTasks.filter((t) => t.phaseId === phase.id && !t.parentId);
      if (!own.length) continue;
      const done = own.filter((t) => t.completed || t.status === 'Done').length;
      const percent = Math.round((done / own.length) * 100);
      const crossings: Array<[50 | 90 | 100, keyof Pick<ProjectPhaseEntity, 'notified50' | 'notified90' | 'notified100'>]> = [
        [100, 'notified100'], [90, 'notified90'], [50, 'notified50'],
      ];
      for (const [threshold, col] of crossings) {
        if (percent < threshold || phase[col]) continue;
        const pName = projectName.get(Number(phase.projectId)) || `Project ${phase.projectId}`;
        for (const user of recipients) {
          const mail = progressEmail({ name: user.name, phaseName: phase.name, projectName: pName, threshold, url: `${base}/projects`, brand });
          await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html })
            .catch((err) => this.log.warn(`Progress notice to ${user.email} failed: ${(err as Error).message}`));
        }
        (phase as any)[col] = new Date().toISOString();
        if (!toStamp.includes(phase)) toStamp.push(phase);
        break; // Only the highest newly-crossed threshold for this tick; lower ones follow next time if still unstamped.
      }
    }
    if (toStamp.length) await this.phases.save(toStamp);
  }

  /**
   * Flags a single assignee whose open-task count is over the office's own
   * threshold. Ships disabled (threshold 0) until Settings has a real number
   * -- the meeting notes were explicit that this number must come from the
   * office, not be invented here. Notifies the overstretched person only;
   * whether a manager should also hear about it is an open decision.
   */
  private async runOverstretch(today: string) {
    if ((await this.settings.get('reminders.overstretchLastRunDate')) === today) return;
    await this.settings.set('reminders.overstretchLastRunDate', today);
    const threshold = parseInt((await this.settings.get('reminders.overstretchThreshold')) || '0', 10);
    if (!threshold || !(await this.google.isConnected())) return;

    const [boardTasks, users] = await Promise.all([this.projectTasks.find(), this.users.find()]);
    const base = await this.settings.baseUrl();
    const brand = await loadEmailBrand(this.settings);
    const counts = new Map<string, number>();
    for (const t of boardTasks) {
      if (t.completed || t.status === 'Done' || t.parentId || !t.assigneeId) continue;
      counts.set(t.assigneeId, (counts.get(t.assigneeId) ?? 0) + 1);
    }
    for (const user of users) {
      const count = counts.get(user.id) ?? 0;
      if (count <= threshold || !user.email || user.status === 'suspended') continue;
      const mail = overstretchEmail({ name: user.name, count, threshold, url: `${base}/tasks`, brand });
      await this.google.sendMail({ to: user.email, subject: mail.subject, html: mail.html })
        .catch((err) => this.log.warn(`Overstretch notice to ${user.email} failed: ${(err as Error).message}`));
    }
  }
}
