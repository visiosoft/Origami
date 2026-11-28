import { BadRequestException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingEntity, PersonEntity, ProjectEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { CalendarService } from '../google/calendar.service';
import { emailsOf } from '../common/emails';
import { mergeCalendars, planSync, type CalEvent, type CalSource, type SyncPlan } from './calendar-sync';
import { MeetingsService } from './meetings.service';
import { GoogleNotesService } from './google-notes.service';

const STATE = 'meetings.calendarSync';
/** Calendar events whose meeting someone deleted: never brought back. */
export const SKIPS = 'meetings.calendarSkips';
const PAST_DAYS = 7;
const AHEAD_DAYS = 14;

export interface SyncState {
  /** Runs every hour once applied the first time. */
  on: boolean;
  /** The first sync was previewed and applied by a person (Nov 19: data steps are preview, then Apply). */
  applied: boolean;
  /** Nov 20: which calendars the hourly run reads. Nov 27 (Weekly Sync): everyone's connected calendars by default. */
  scope?: Scope;
  last?: { at: string; events: number; created: number; moved: number; cancelled: number; notes: number; error?: string | null; sources?: SourceResult[] } | null;
}

export type Scope = 'company' | 'everyone';
export interface SourceResult { name: string; email: string; company: boolean; ok: boolean; events: number; error?: string; userId?: string }

type Actor = { name: string; id?: string };

/**
 * Nov 19 ("we connected our @origamidb calendar but meetings aren't pulled
 * in"): every hour, the connected company account's calendar -- a week back,
 * two weeks ahead -- becomes Meetings. New events are added, moved ones follow,
 * cancelled ones are marked cancelled; Gemini's notes Doc attached to an event
 * is read in once the meeting is over (the hourly notes sweep covers the rest).
 */
@Injectable()
export class CalendarSyncService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('CalendarSync');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(MeetingEntity) private readonly meetings: Repository<MeetingEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly settings: SettingsService,
    @Optional() private readonly google?: GoogleService,
    @Optional() private readonly calendar?: CalendarService,
    @Optional() private readonly meetingsService?: MeetingsService,
    @Optional() private readonly notes?: GoogleNotesService,
    @Optional() @InjectRepository(PersonEntity) private readonly people?: Repository<PersonEntity>,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.tick(); }, 3600_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async state(): Promise<SyncState> {
    try { const v = JSON.parse((await this.settings.get(STATE)) || '{}'); return { on: v.on !== false, applied: !!v.applied, scope: v.scope === 'company' ? 'company' : 'everyone', last: v.last || null }; } catch { return { on: true, applied: false, scope: 'everyone', last: null }; }
  }
  private async saveState(s: SyncState) { await this.settings.set(STATE, JSON.stringify(s)); }

  async status() {
    const g = this.google ? await this.google.status().catch(() => null) : null;
    const email = String(g?.connectedEmail || '');
    const staff = (await this.users.find()).filter((u) => u.status !== 'suspended' && (u.tier || 'internal') === 'internal');
    const people = staff.filter((u) => u.calendarRefreshToken).map((u) => ({ name: u.name, email: String(u.calendarEmail || u.email || '') }));
    const state = await this.state();
    // Nov 27: each staff member's calendar -- connected or not, and what the last run read from it.
    const bySource = new Map((state.last?.sources || []).filter((r) => !r.company).map((r) => [r.userId || r.email.toLowerCase(), r]));
    const calendars = staff.map((u) => {
      const r = bySource.get(u.id) || bySource.get(String(u.calendarEmail || u.email || '').toLowerCase());
      return { id: u.id, name: u.name, email: String(u.calendarEmail || u.email || ''), connected: !!u.calendarRefreshToken, lastAt: r ? state.last?.at || null : null, events: r?.events ?? null, ok: r ? r.ok : null, error: r?.error || null };
    }).sort((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name));
    return { ...state, connected: !!g?.connected, connectedEmail: email, people, calendars, notConnected: staff.length - people.length, window: { pastDays: PAST_DAYS, aheadDays: AHEAD_DAYS } };
  }

  async setOn(on: boolean) {
    const s = await this.state();
    await this.saveState({ ...s, on: !!on });
    return this.status();
  }

  /** Every calendar to read: the company one, then (scope 'everyone') each person's own. One that fails is noted, not fatal. */
  private async read(scope: Scope, from: string, to: string, users: UserEntity[]): Promise<{ sources: CalSource[]; results: SourceResult[] }> {
    const sources: CalSource[] = []; const results: SourceResult[] = [];
    const companyOn = !!this.google && (await this.google.isConnected().catch(() => false));
    if (companyOn) {
      const email = String((await this.google!.status().catch(() => null))?.connectedEmail || '');
      try {
        const events = (await this.calendar!.companyEvents(from, to)) as CalEvent[];
        sources.push({ email, personal: false, events }); results.push({ name: 'Company calendar', email, company: true, ok: true, events: events.length });
      } catch (e) { results.push({ name: 'Company calendar', email, company: true, ok: false, events: 0, error: (e as Error).message }); }
    }
    if (scope === 'everyone') {
      for (const u of users.filter((x) => x.calendarRefreshToken && x.status !== 'suspended')) {
        const email = String(u.calendarEmail || u.email || '').toLowerCase();
        try {
          const events = (await this.calendar!.eventsAs(u.id, u.calendarRefreshToken, from, to)) as CalEvent[];
          sources.push({ email, personal: true, events }); results.push({ name: u.name, email, company: false, ok: true, events: events.length, userId: u.id });
        } catch (e) { results.push({ name: u.name, email, company: false, ok: false, events: 0, error: (e as Error).message, userId: u.id }); }
      }
    }
    if (!results.length) throw new BadRequestException('No calendar to read: connect the company Google account (Settings → Google) or your own calendar (Settings → My Calendar).');
    if (!sources.length) throw new BadRequestException(results.map((r) => `${r.name}: ${r.error}`).join(' · '));
    return { sources, results };
  }

  /** What a sync would do now, without changing anything. */
  async plan(now = new Date(), scope: Scope = 'everyone'): Promise<{ plan: SyncPlan; events: number; sources: SourceResult[] }> {
    if (!this.calendar) throw new BadRequestException('Google Calendar isn’t available on this server.');
    const from = new Date(now.getTime() - PAST_DAYS * 864e5).toISOString();
    const to = new Date(now.getTime() + AHEAD_DAYS * 864e5).toISOString();
    const [meetings, users, projects] = await Promise.all([this.meetings.find(), this.users.find(), this.projects.find()]);
    const { sources, results } = await this.read(scope, from, to, users);
    const events = mergeCalendars(sources);
    let skips: string[] = [];
    try { skips = JSON.parse((await this.settings.get(SKIPS)) || '[]'); } catch { skips = []; }
    const email = sources.find((s) => !s.personal)?.email || sources[0]?.email || '';
    const domain = email.split('@')[1]?.toLowerCase() || '';
    const plan = planSync(
      events,
      meetings.map((m) => ({ id: m.id, calendarEventId: m.calendarEventId, date: m.date, time: m.time, status: m.status, archivedAt: m.archivedAt, title: m.title })),
      [
        ...users.filter((u) => u.status !== 'suspended').map((u) => ({ id: u.id, name: u.name, emails: [...new Set([...emailsOf(u), ...(u.calendarEmail ? [String(u.calendarEmail).toLowerCase()] : [])])] })),
        // Nov 27: People records name the outside attendees (consultants, clients) too.
        ...((await this.people?.find({ select: { id: true, name: true, email: true } as any }).catch(() => [])) || []).map((p) => ({ name: p.name, emails: emailsOf(p as any) })).filter((p) => p.emails.length),
      ],
      projects.filter((p: any) => !p.archivedAt).map((p) => ({ id: p.id, name: p.name })),
      new Set(skips), domain,
    );
    // Notes: only for meetings that are over and have none yet.
    const byId = new Map(meetings.map((m) => [m.id, m]));
    plan.notes = plan.notes.filter((n) => { const m = byId.get(n.id); return !!m && !m.notesDocId && !String(m.minutes || '').trim(); });
    return { plan, events: events.length, sources: results };
  }

  /** Preview for the first run: the events that would become meetings. */
  async preview() {
    const { plan, events, sources } = await this.plan();
    return { events, sources, create: plan.create.map((c) => ({ title: c.title, date: c.date, time: c.time, attendees: c.attendees.length, project: c.project || null, type: c.type })), move: plan.move, cancel: plan.cancel, skipped: plan.skipped };
  }

  /** Make the meetings. The first time it's a person pressing Apply; after that, every hour. */
  async apply(actor: Actor = { name: 'Google Calendar' }, scope: Scope = 'everyone') {
    if (this.running) throw new BadRequestException('A calendar sync is already running.');
    this.running = true;
    const at = new Date().toISOString();
    try {
      const { plan, events, sources } = await this.plan(new Date(), scope);
      let created = 0; let moved = 0; let cancelled = 0; let notes = 0;
      for (const c of plan.create) {
        if (!this.meetingsService) break;
        try { await this.meetingsService.create(c as any, actor); created++; } catch (e) { this.log.warn(`Not added: ${c.title}: ${(e as Error).message}`); }
      }
      for (const mv of plan.move) {
        const m = await this.meetings.findOneBy({ id: mv.id });
        if (!m) continue;
        Object.assign(m, { date: mv.date, time: mv.time, status: m.status === 'scheduled' ? 'rescheduled' : m.status, updatedAt: at });
        await this.meetings.save(m); moved++;
      }
      for (const cn of plan.cancel) {
        const m = await this.meetings.findOneBy({ id: cn.id });
        if (!m) continue;
        Object.assign(m, { status: 'cancelled', updatedAt: at });
        await this.meetings.save(m); cancelled++;
      }
      for (const n of plan.notes) {
        const m = await this.meetings.findOneBy({ id: n.id });
        if (!m || !this.notes) continue;
        try { if (await this.notes.importFor(m, undefined, n.docId)) notes++; } catch { /* not readable yet -- the notes sweep tries again */ }
      }
      const last = { at, events, created, moved, cancelled, notes, error: null, sources };
      const prev = await this.state();
      await this.saveState({ ...prev, applied: true, scope: scope === 'everyone' ? 'everyone' : prev.scope, last });
      if (created || moved || cancelled || notes) this.log.log(`Calendar: ${created} new, ${moved} moved, ${cancelled} cancelled, ${notes} notes`);
      return last;
    } catch (e) {
      const last = { at, events: 0, created: 0, moved: 0, cancelled: 0, notes: 0, error: (e as Error).message };
      await this.saveState({ ...(await this.state()), last }).catch(() => undefined);
      throw e;
    } finally { this.running = false; }
  }

  /** The hourly run: only once someone applied the first sync, and while it's on. */
  async tick() {
    const s = await this.state().catch(() => null);
    if (!s?.on || !s.applied) return null;
    return this.apply(undefined, s.scope || 'everyone').catch((e) => { this.log.warn(`Calendar sync: ${(e as Error).message}`); return null; });
  }

  /** A deleted meeting's event is never brought back. */
  async skip(eventIds: string[]) {
    const ids = eventIds.filter(Boolean);
    if (!ids.length) return;
    let list: string[] = [];
    try { list = JSON.parse((await this.settings.get(SKIPS)) || '[]'); } catch { list = []; }
    await this.settings.set(SKIPS, JSON.stringify([...new Set([...list, ...ids])].slice(-2000)));
  }
}
