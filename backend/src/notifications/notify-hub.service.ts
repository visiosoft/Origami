import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { NotificationItemEntity, PersonEntity, ProjectTaskEntity, RoleEntity, TaskEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { SmsService } from '../sms/sms.service';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { effectivePermissions, extentOf } from '../users/access-levels';
import { isTaskDone } from '../database/task.types';
import { isClosedStatus, parseLogStatuses, LOG_STATUSES_KEY } from '../tasks/log-statuses';
import { channelsFor, channelWarnings, cleanMatrix, eventOf, isDigest, isText, NOTIFY_EVENTS, type Channel, type Matrix } from './matrix';

/** What happened, for the email, the text and the in-app list. */
export interface NotifyItem {
  title: string;
  body?: string;
  /** In-app path (/tasks?task=…) -- made absolute for emails and texts. */
  path?: string;
  /** Who did it: never told about their own change. */
  actorId?: string;
}

const HOUR = 3600000;
const DEFAULT_TZ = 'America/Los_Angeles';
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * Sends each notification the way each person chose (matrix.ts): a text or an
 * email straight away, or into their daily / weekly digest. Everything also
 * lands in their in-app list (Notifications page). Digests, and the due-
 * tomorrow / past-due / three-week checks, run once a day at the reminder hour.
 */
@Injectable()
export class NotifyHub implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('NotifyHub');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(NotificationItemEntity) private readonly items: Repository<NotificationItemEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly projectTasks: Repository<ProjectTaskEntity>,
    @InjectRepository(TaskEntity) private readonly logTasks: Repository<TaskEntity>,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
    @Optional() private readonly sms?: SmsService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.tick(); }, HOUR);
    this.timer.unref?.();
    setTimeout(() => { void this.tick(); }, 90_000).unref?.();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  // ------------------------------------------------------------------ preferences

  /** A person's settings: the matrix (with defaults filled in), their phone, and what's missing. */
  async prefs(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) return null;
    const matrix = Object.fromEntries(NOTIFY_EVENTS.map((e) => [e.key, channelsFor(user as any, e.key)]));
    const phone = await this.phoneOf(user);
    const smsReady = !!(this.sms && (await this.sms.status().catch(() => null))?.configured);
    return {
      events: NOTIFY_EVENTS.map(({ key, label, group, hint }) => ({ key, label, group, hint })),
      matrix, custom: !!user.notificationMatrix,
      phone: user.phone || '', phoneFromPeople: !user.phone ? phone : '',
      warnings: channelWarnings(matrix as Matrix, { phone: !!phone, email: !!user.email, smsReady }),
    };
  }

  async setPrefs(userId: string, body: { matrix?: unknown; phone?: unknown }) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) return null;
    if (body.matrix !== undefined) user.notificationMatrix = body.matrix === null ? null : cleanMatrix(body.matrix);
    if (typeof body.phone === 'string') user.phone = body.phone.trim().slice(0, 40);
    await this.users.save(user);
    return this.prefs(userId);
  }

  /** Their own number, else the one on their People record (linked login, or same email). */
  async phoneOf(user: UserEntity): Promise<string> {
    if (user.phone?.trim()) return user.phone.trim();
    const email = String(user.email || '').trim().toLowerCase();
    const person = (await this.people.find()).find((p) => (p.userId && p.userId === user.id) || (!!email && String(p.email || '').trim().toLowerCase() === email));
    const phone = String(person?.phone || '').trim();
    return phone && phone !== '—' ? phone : '';
  }

  // ------------------------------------------------------------------ sending

  /**
   * Tell these people about an event, each the way they chose. `email`
   * replaces the plain email for events that have their own (task emails).
   * Returns per person whether an immediate email is wanted, for callers that
   * send it themselves.
   */
  async deliver(userIds: string[], event: string, item: NotifyItem, opts: { email?: (user: UserEntity) => Promise<unknown> } = {}) {
    const ids = [...new Set(userIds.filter((id) => id && id !== item.actorId))];
    if (!ids.length) return;
    const all = await this.users.find();
    for (const id of ids) {
      const user = all.find((u) => u.id === id);
      if (!user || user.status === 'suspended') continue;
      const channels = channelsFor(user as any, event);
      if (!channels.length) continue;
      try { await this.send(user, event, item, channels, opts.email); }
      catch (e) { this.log.warn(`${event} for ${id}: ${(e as Error).message}`); }
    }
  }

  /**
   * A company-wide event (a new lead, a project's status): everyone internal
   * who can see that menu item -- and, for those who only see their assigned
   * projects, only when it's one of theirs.
   */
  async broadcast(event: string, item: NotifyItem, scope: { projectName?: string } = {}) {
    const module = eventOf(event)?.module;
    const [users, roles, people] = await Promise.all([this.users.find(), this.roles.find(), scope.projectName ? this.people.find() : Promise.resolve([] as PersonEntity[])]);
    const ids = users.filter((u) => {
      if (u.status === 'suspended' || u.status === 'pending') return false;
      if (u.roleKey !== 'admin' && u.tier !== 'internal') return false;
      if (u.roleKey === 'admin') return true;
      const perms = effectivePermissions(roles.find((r) => r.key === u.roleKey)?.permissions as any, u.permissionOverrides as any);
      if (module && perms[module] && !perms[module].view) return false;
      if (scope.projectName && extentOf(perms) === 'assigned') {
        const email = String(u.email || '').trim().toLowerCase();
        return people.some((p) => ((p.userId && p.userId === u.id) || (!!email && String(p.email || '').trim().toLowerCase() === email)) && (p.projects || []).includes(scope.projectName!));
      }
      return true;
    }).map((u) => u.id);
    await this.deliver(ids, event, item);
  }

  private async send(user: UserEntity, event: string, item: NotifyItem, channels: Channel[], email?: (user: UserEntity) => Promise<unknown>) {
    const base = await this.settings.baseUrl();
    const url = item.path ? base + item.path : base || '';
    const digests = channels.filter(isDigest);
    await this.items.save(this.items.create({
      id: 'N-' + randomUUID(), userId: user.id, event, title: item.title.slice(0, 500), body: item.body || null,
      url: item.path || null, at: new Date().toISOString(), digests: digests.length ? digests : null, sent: null,
    }));
    if (channels.includes('text_now')) {
      const phone = await this.phoneOf(user);
      if (phone && this.sms) {
        const label = eventOf(event)?.label || 'Update';
        await this.sms.send({ to: phone, body: `${label}: ${item.title}${url ? ' — ' + url : ''}`.slice(0, 320) })
          .catch((e) => this.log.warn(`Text to ${user.id} not sent: ${(e as Error).message}`));
      }
    }
    if (channels.includes('email_now')) {
      if (email) await email(user);
      else await this.plainEmail(user, event, item, url);
    }
  }

  private async plainEmail(user: UserEntity, event: string, item: NotifyItem, url: string) {
    if (!user.email || !(await this.google.isConnected())) return;
    const brand = await loadEmailBrand(this.settings);
    const ev = eventOf(event);
    const html = emailShell({
      brand, eyebrow: ev?.label || 'Update', title: item.title,
      body: item.body ? `<p style="margin:0;font-size:14px;line-height:1.65;color:#43514D;white-space:pre-wrap;">${escapeHtml(item.body)}</p>` : '',
      cta: url ? { label: 'Open', url } : undefined,
      footer: `You get these because of your notification settings. <a href="${(await this.settings.baseUrl())}/settings?tab=notifications" style="color:#2F7D4A;">Change them</a>.`,
    });
    await this.google.sendMail({ to: user.email, subject: `${ev?.label || 'Update'}: ${item.title}`, html });
  }

  // ------------------------------------------------------------------ the daily run

  private localNow(tz: string) {
    try {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date()).map((p) => [p.type, p.value]));
      return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: parseInt(parts.hour, 10) % 24 };
    } catch { const d = new Date(); return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() }; }
  }

  /** Hourly: at the reminder hour (Settings), once a day, check due dates and send digests. */
  async tick() {
    try {
      const tz = (await this.settings.get('reminders.timezone')) || DEFAULT_TZ;
      const hour = parseInt((await this.settings.get('reminders.hour')) || '7', 10);
      const now = this.localNow(tz);
      if (now.hour !== hour) return;
      if ((await this.settings.get('notifications.lastDailyRun')) === now.date) return;
      await this.settings.set('notifications.lastDailyRun', now.date);
      await this.runDaily(now.date);
    } catch (e) {
      this.log.error('Daily notifications failed: ' + (e as Error).message);
    }
  }

  async runDaily(today: string) {
    const monday = new Date(`${today}T12:00:00Z`).getUTCDay() === 1;
    await this.dueChecks(today, monday);
    await this.sendDigests('daily');
    if (monday) await this.sendDigests('weekly');
  }

  /** Open tasks, with who has them and when they're due (both task lists). */
  private async openTasks() {
    const closed = parseLogStatuses(await this.settings.get(LOG_STATUSES_KEY));
    const board = (await this.projectTasks.find()).filter((t) => !t.archivedAt && !t.phaseId && !isTaskDone(t) && t.assigneeId && /^\d{4}-\d{2}-\d{2}/.test(t.dueDate || ''))
      .map((t) => ({ userId: t.assigneeId, title: t.title, due: t.dueDate.slice(0, 10), path: `/tasks?task=${encodeURIComponent(t.id)}${t.projectId != null ? `&project=${t.projectId}` : ''}` }));
    const log = (await this.logTasks.find()).filter((t) => !t.archivedAt && !isClosedStatus(closed, t.status) && t.assignedToId && /^\d{4}-\d{2}-\d{2}/.test(t.dueDate || ''))
      .map((t) => ({ userId: t.assignedToId, title: t.subject || String(t.description || '').split('\n')[0] || t.id, due: t.dueDate.slice(0, 10), path: `/tasks?task=${encodeURIComponent(t.id)}&type=log` }));
    return [...board, ...log];
  }

  /** Due tomorrow, past due (daily), and Monday's three-week look-ahead. */
  async dueChecks(today: string, monday: boolean) {
    const tasks = await this.openTasks();
    const tomorrow = addDays(today, 1);
    for (const t of tasks.filter((x) => x.due === tomorrow)) await this.deliver([t.userId], 'due_tomorrow', { title: `Due tomorrow: ${t.title}`, path: t.path });
    for (const t of tasks.filter((x) => x.due < today)) await this.deliver([t.userId], 'past_due', { title: `Past due (was due ${t.due}): ${t.title}`, path: t.path });
    if (!monday) return;
    const end = addDays(today, 21);
    const byUser = new Map<string, typeof tasks>();
    for (const t of tasks.filter((x) => x.due >= today && x.due <= end)) byUser.set(t.userId, [...(byUser.get(t.userId) || []), t]);
    for (const [userId, list] of byUser) {
      list.sort((a, b) => a.due.localeCompare(b.due));
      await this.deliver([userId], 'three_week', {
        title: `${list.length} task${list.length === 1 ? '' : 's'} due in the next three weeks`,
        body: list.map((t) => `${t.due} — ${t.title}`).join('\n'), path: '/tasks',
      });
    }
  }

  /** Everyone's pending daily (or weekly) items, as one email and/or one text each. */
  async sendDigests(cadence: 'daily' | 'weekly') {
    const pending = (await this.items.find()).filter((i) => (i.digests || []).some((d) => d.endsWith('_' + cadence) && !(i.sent || []).includes(d)));
    if (!pending.length) return 0;
    const base = await this.settings.baseUrl();
    const users = await this.users.find();
    let sent = 0;
    for (const userId of [...new Set(pending.map((i) => i.userId))]) {
      const user = users.find((u) => u.id === userId);
      const mine = pending.filter((i) => i.userId === userId);
      for (const kind of ['email', 'text'] as const) {
        const key = `${kind}_${cadence}`;
        const list = mine.filter((i) => (i.digests || []).includes(key) && !(i.sent || []).includes(key));
        if (!list.length || !user) continue;
        try {
          if (kind === 'email') await this.digestEmail(user, cadence, list, base);
          else {
            const phone = await this.phoneOf(user);
            if (phone && this.sms) await this.sms.send({ to: phone, body: `Your ${cadence} digest: ${list.length} update${list.length === 1 ? '' : 's'} — ${base}/notifications?digest=${cadence}` });
          }
          sent++;
        } catch (e) { this.log.warn(`${key} digest for ${userId}: ${(e as Error).message}`); }
        for (const i of list) await this.items.update({ id: i.id }, { sent: [...(i.sent || []), key] } as any);
      }
    }
    return sent;
  }

  private async digestEmail(user: UserEntity, cadence: 'daily' | 'weekly', list: NotificationItemEntity[], base: string) {
    if (!user.email || !(await this.google.isConnected())) return;
    const brand = await loadEmailBrand(this.settings);
    const groups = NOTIFY_EVENTS.filter((e) => list.some((i) => i.event === e.key));
    const body = groups.map((e) => `
      <div style="margin:0 0 16px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B7A74;margin-bottom:6px;">${escapeHtml(e.label)}</div>
        ${list.filter((i) => i.event === e.key).map((i) => `<div style="padding:7px 0;border-top:1px solid rgba(20,8,31,0.07);font-size:13.5px;line-height:1.5;color:#0B1A12;">${i.url ? `<a href="${base}${i.url}" style="color:#0B1A12;">${escapeHtml(i.title)}</a>` : escapeHtml(i.title)}</div>`).join('')}
      </div>`).join('');
    await this.google.sendMail({
      to: user.email,
      subject: `Your ${cadence} digest — ${list.length} update${list.length === 1 ? '' : 's'}`,
      html: emailShell({
        brand, eyebrow: cadence === 'daily' ? 'Daily digest' : 'Weekly digest', title: `${list.length} update${list.length === 1 ? '' : 's'}`, body,
        cta: { label: 'Open in Origami', url: `${base}/notifications?digest=${cadence}` },
        footer: `You get this digest because of your notification settings. <a href="${base}/settings?tab=notifications" style="color:#2F7D4A;">Change them</a>.`,
      }),
    });
  }

  // ------------------------------------------------------------------ the in-app list

  async feed(userId: string, opts: { digest?: string } = {}) {
    const rows = (await this.items.find({ where: { userId } })).sort((a, b) => b.at.localeCompare(a.at));
    const shown = opts.digest === 'daily' || opts.digest === 'weekly' ? rows.filter((r) => (r.digests || []).some((d) => d.endsWith('_' + opts.digest))) : rows;
    return shown.slice(0, 300).map((r) => ({ id: r.id, event: r.event, label: eventOf(r.event)?.label || r.event, title: r.title, body: r.body, url: r.url, at: r.at }));
  }
}
