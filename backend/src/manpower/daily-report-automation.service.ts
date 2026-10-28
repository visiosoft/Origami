import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyLogEntity, ProjectEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { ProjectHoldService } from '../project-tasks/project-hold.service';
import { emailShell, loadEmailBrand } from '../email/shell';

const HOUR = 60 * 60 * 1000;
const DEFAULT_TZ = 'America/Los_Angeles';
/** Follow-up date for a stop order with no known end. */
export const UNKNOWN_STOP_FOLLOW_UP_DAYS = 14;
/** Days before a stop order's end when the team is reminded. */
export const STOP_NOTICE_DAYS = [7, 2];
const MAX_DAYS = 366;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const plus = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const niceDate = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

type Activity = { worked?: string; reason?: string; stop?: { by?: string; asOf?: string; end?: string; endUnknown?: boolean; details?: string }; holiday?: { start?: string; end?: string } };
const activityOf = (log: Pick<DailyLogEntity, 'sections'>): Activity => (log.sections && typeof log.sections === 'object' ? (log.sections as any).activity || {} : {});

/** What a filed report asks the system to do: stop or holiday, over which days. */
export function noWorkRange(log: Pick<DailyLogEntity, 'sections' | 'date'>): { reason: 'stop' | 'holiday'; from: string; to: string | null } | null {
  const a = activityOf(log);
  if (a.worked !== 'no') return null;
  if (a.reason === 'stop') {
    const from = ISO.test(a.stop?.asOf || '') ? a.stop!.asOf! : log.date;
    const to = !a.stop?.endUnknown && ISO.test(a.stop?.end || '') ? a.stop!.end! : null;
    return { reason: 'stop', from, to };
  }
  if (a.reason === 'holiday') {
    const from = ISO.test(a.holiday?.start || '') ? a.holiday!.start! : log.date;
    const to = ISO.test(a.holiday?.end || '') ? a.holiday!.end! : from;
    return { reason: 'holiday', from, to };
  }
  return null;
}

/**
 * The Daily Report's stop-order and holiday follow-through:
 *  - a stop order puts the project on HOLD when it's submitted;
 *  - every stop / holiday day gets a report made automatically (as the days arrive);
 *  - the team is emailed a week and two days before a stop order's end date.
 * Only a person takes a project off hold (Projects -> Resume).
 */
@Injectable()
export class DailyReportAutomationService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('DailyReportAutomation');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(DailyLogEntity) private readonly logs: Repository<DailyLogEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly settings: SettingsService,
    private readonly hold: ProjectHoldService,
    @Optional() private readonly google?: GoogleService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.tick(); }, HOUR);
    this.timer.unref?.();
    setTimeout(() => { void this.tick(); }, 90_000).unref?.();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async today(): Promise<string> {
    const tz = (await this.settings.get('reminders.timezone')) || DEFAULT_TZ;
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
      return `${p.year}-${p.month}-${p.day}`;
    } catch { return new Date().toISOString().slice(0, 10); }
  }

  /** Hourly; does the day's work once (the settings key doubles as a lock across instances). */
  async tick() {
    try {
      const today = await this.today();
      if ((await this.settings.get('dailyReports.autoRunDate')) === today) return;
      await this.settings.set('dailyReports.autoRunDate', today);
      await this.runDaily(today);
    } catch (e) {
      this.log.error('Daily report automation failed: ' + (e as Error).message);
    }
  }

  /** A report was submitted: a stop order holds the project, and any days already passed get their reports. */
  async afterSubmit(logId: string, actor: { id?: string; name: string }) {
    const log = await this.logs.findOneBy({ id: logId });
    if (!log) return { held: false, created: 0 };
    const range = noWorkRange(log);
    if (!range) return { held: false, created: 0 };
    const today = await this.today();
    let held = false;
    if (range.reason === 'stop') {
      const a = activityOf(log);
      const until = range.to || plus(today, UNKNOWN_STOP_FOLLOW_UP_DAYS);
      const reason = [
        `Stop order${a.stop?.by ? ` by ${a.stop.by}` : ''}${range.from ? ` as of ${niceDate(range.from)}` : ''}${range.to ? `, projected to end ${niceDate(range.to)}` : ' — end date unknown, follow up by this date'}.`,
        (a.stop?.details || '').trim(),
        `From the daily report for ${niceDate(log.date)}.`,
      ].filter(Boolean).join(' ');
      try {
        await this.hold.hold(Number(log.projectId), { until, reason, followUpId: log.supervisorId || actor.id }, { id: actor.id, name: actor.name });
        held = true;
      } catch (e) { this.log.warn(`Could not put project ${log.projectId} on hold: ${(e as Error).message}`); }
    }
    const created = await this.fillDays(log, today);
    return { held, created };
  }

  /** Every day: make the reports for stop / holiday days that have arrived, and send end-of-stop reminders. */
  async runDaily(today: string) {
    const sources = (await this.logs.find()).filter((l) => !l.autoReason && (l.status === 'submitted' || l.status === 'approved') && noWorkRange(l));
    let created = 0, notices = 0;
    for (const s of sources) {
      created += await this.fillDays(s, today);
      notices += await this.stopNotices(s, today);
    }
    if (created || notices) this.log.log(`Daily reports: ${created} made automatically, ${notices} stop-order reminders sent`);
    return { created, notices };
  }

  /** One automatic report for each stop / holiday day up to today that has no report yet. */
  async fillDays(source: DailyLogEntity, today: string): Promise<number> {
    const range = noWorkRange(source);
    if (!range) return 0;
    let end = range.to && range.to < today ? range.to : today;
    if (range.reason === 'stop') {
      // While the project stays on hold; once someone resumes it, no more stop days are made.
      const project = await this.projects.findOneBy({ id: Number(source.projectId) });
      if (!project?.holdSince) return 0;
    }
    if (range.from > end) return 0;
    if (daysBetween(range.from, end) > MAX_DAYS) end = plus(range.from, MAX_DAYS);
    const existing = new Set((await this.logs.find({ where: { projectId: source.projectId } })).map((l) => l.date));
    const activity = activityOf(source);
    let n = 0;
    for (let d = range.from; d <= end; d = plus(d, 1)) {
      if (existing.has(d)) continue;
      const now = new Date().toISOString();
      await this.logs.save(this.logs.create({
        id: 'DL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
        projectId: source.projectId, date: d, version: 1, status: 'approved', autoReason: range.reason,
        sections: { activity }, notes: '',
        supervisorId: source.supervisorId, supervisorName: source.supervisorName,
        submittedAt: now, approvedByName: 'Automatic', approvedAt: now, createdAt: now,
      } as Partial<DailyLogEntity>));
      existing.add(d);
      n++;
    }
    return n;
  }

  /** "Stop order ends in 7 / 2 days" to whoever filed it and the admins -- each once. */
  async stopNotices(source: DailyLogEntity, today: string): Promise<number> {
    const range = noWorkRange(source);
    if (!range || range.reason !== 'stop' || !range.to || !this.google) return 0;
    const left = daysBetween(today, range.to);
    if (!STOP_NOTICE_DAYS.includes(left)) return 0;
    const project = await this.projects.findOneBy({ id: Number(source.projectId) });
    if (!project?.holdSince) return 0; // already back at work
    const key = `dailyReports.notice.${source.id}.${left}`;
    if (await this.settings.get(key)) return 0;
    await this.settings.set(key, today);
    const users = await this.users.find();
    const to = Array.from(new Set(users
      .filter((u) => u.status !== 'suspended' && u.email && (u.id === source.supervisorId || u.roleKey === 'admin'))
      .map((u) => u.email.trim().toLowerCase())));
    if (!to.length || !(await this.google.isConnected().catch(() => false))) return 0;
    const brand = await loadEmailBrand(this.settings);
    const base = await this.settings.baseUrl();
    const a = activityOf(source);
    const html = emailShell({
      brand, eyebrow: 'Stop order', title: `${escapeHtml(project.name)}: the stop order ends ${niceDate(range.to)}`,
      body: `<p style="margin:0 0 10px;">That's ${left} days from today. Time to plan the restart — crew, subs and deliveries.</p>`
        + `<p style="margin:0 0 10px;color:#43514D;">Stopped by ${escapeHtml(a.stop?.by || '—')} as of ${escapeHtml(range.from ? niceDate(range.from) : '—')}.${a.stop?.details ? ` ${escapeHtml(a.stop.details)}` : ''}</p>`
        + `<p style="margin:0;color:#43514D;">The project stays on hold until someone resumes it in Projects.</p>`,
      cta: { label: 'Open the project', url: `${base}/projects?open=${project.id}` },
      footer: 'Sent because a daily report put this project on a stop order. You get it as the person who filed it, or as an admin.',
    });
    for (const addr of to) {
      await this.google.sendMail({ to: addr, subject: `${project.name}: stop order ends in ${left} days`, html }).catch((e) => this.log.warn(`Stop notice to ${addr} failed: ${(e as Error).message}`));
    }
    return 1;
  }
}
