import { BadRequestException, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingEntity, ProjectEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService } from '../google/google.service';
import { CalendarService } from '../google/calendar.service';
import { emailsOf } from '../common/emails';
import { planSync, type CalEvent, type SyncPlan } from './calendar-sync';
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
  last?: { at: string; events: number; created: number; moved: number; cancelled: number; notes: number; error?: string | null } | null;
}

type Actor = { name: string; id?: string };

/**
 * One meeting sits in every guest's calendar under the same event id: it is
 * one meeting here. A copy that is cancelled only in one person's calendar
 * (they were taken off the invite), or one they declined, does not cancel or
 * hide it for everybody else.
 */
export function mergeEvents(events: CalEvent[]): CalEvent[] {
  // The copy to keep: one that is on, from someone who has not declined it.
  const rank = (e: any) => (e.status === 'cancelled' ? 2 : (e.attendees || []).some((a: any) => a.self && a.responseStatus === 'declined') ? 1 : 0);
  const byId = new Map<string, CalEvent>();
  for (const e of events) {
    const id = (e as any).id;
    if (!id) continue;
    const had = byId.get(id);
    if (!had || rank(e) < rank(had)) byId.set(id, e);
  }
  return [...byId.values()];
}

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
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.tick(); }, 3600_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async state(): Promise<SyncState> {
    try { const v = JSON.parse((await this.settings.get(STATE)) || '{}'); return { on: v.on !== false, applied: !!v.applied, last: v.last || null }; } catch { return { on: true, applied: false, last: null }; }
  }
  private async saveState(s: SyncState) { await this.settings.set(STATE, JSON.stringify(s)); }

  /** Everyone whose own calendar is connected (Settings → My Calendar), and not suspended. */
  private async people() {
    return (await this.users.find()).filter((u: any) => u.status !== 'suspended' && u.calendarRefreshToken);
  }

  /**
   * Nov 20 ("for all people it is showing this email"): each person's own
   * calendar is read, so the panel shows the viewer's own address and how many
   * people's calendars come in -- not the one shared company account.
   */
  async status(viewerId?: string) {
    const people = await this.people();
    const me = viewerId ? people.find((u: any) => u.id === viewerId) : null;
    return {
      ...(await this.state()),
      connected: !!me, connectedEmail: me ? String((me as any).calendarEmail || me.email || '') : '',
      people: people.length,
      window: { pastDays: PAST_DAYS, aheadDays: AHEAD_DAYS },
    };
  }

  async setOn(on: boolean) {
    const s = await this.state();
    await this.saveState({ ...s, on: !!on });
    return this.status();
  }

  /** What a sync would do now, without changing anything. */
  async plan(now = new Date()): Promise<{ plan: SyncPlan; events: number }> {
    const people = await this.people();
    if (!this.calendar || !people.length) throw new BadRequestException('Nobody’s calendar is connected yet — each person connects their own under Settings → My Calendar.');
    const from = new Date(now.getTime() - PAST_DAYS * 864e5).toISOString();
    const to = new Date(now.getTime() + AHEAD_DAYS * 864e5).toISOString();
    // Every person's own calendar; one that can't be read is skipped, not the whole run.
    const all: CalEvent[] = [];
    let read = 0;
    for (const u of people) {
      try { all.push(...((await this.calendar.userEvents(u.id, (u as any).calendarRefreshToken, from, to)) as CalEvent[])); read++; }
      catch (e) { this.log.warn(`Calendar of ${(u as any).calendarEmail || u.email} not read: ${(e as Error).message}`); }
    }
    if (!read) throw new BadRequestException('None of the connected calendars could be read — reconnect under Settings → My Calendar.');
    const events = mergeEvents(all);
    const [meetings, users, projects] = await Promise.all([this.meetings.find(), this.users.find(), this.projects.find()]);
    let skips: string[] = [];
    try { skips = JSON.parse((await this.settings.get(SKIPS)) || '[]'); } catch { skips = []; }
    // The company's own domain: the one most connected calendars are on.
    const domains = people.map((u: any) => String(u.calendarEmail || u.email || '').split('@')[1]?.toLowerCase()).filter(Boolean) as string[];
    const domain = domains.sort((a, b) => domains.filter((d) => d === b).length - domains.filter((d) => d === a).length)[0] || '';
    const plan = planSync(
      events,
      meetings.map((m) => ({ id: m.id, calendarEventId: m.calendarEventId, date: m.date, time: m.time, status: m.status, archivedAt: m.archivedAt, title: m.title })),
      users.filter((u) => u.status !== 'suspended').map((u) => ({ id: u.id, name: u.name, emails: emailsOf(u) })),
      projects.filter((p: any) => !p.archivedAt).map((p) => ({ id: p.id, name: p.name })),
      new Set(skips), domain,
    );
    // Notes: only for meetings that are over and have none yet.
    const byId = new Map(meetings.map((m) => [m.id, m]));
    plan.notes = plan.notes.filter((n) => { const m = byId.get(n.id); return !!m && !m.notesDocId && !String(m.minutes || '').trim(); });
    return { plan, events: events.length };
  }

  /** Preview for the first run: the events that would become meetings. */
  async preview() {
    const { plan, events } = await this.plan();
    return { events, create: plan.create.map((c) => ({ title: c.title, date: c.date, time: c.time, attendees: c.attendees.length, project: c.project || null, type: c.type })), move: plan.move, cancel: plan.cancel, skipped: plan.skipped };
  }

  /** Make the meetings. The first time it's a person pressing Apply; after that, every hour. */
  async apply(actor: Actor = { name: 'Google Calendar' }) {
    if (this.running) throw new BadRequestException('A calendar sync is already running.');
    this.running = true;
    const at = new Date().toISOString();
    try {
      const { plan, events } = await this.plan();
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
      const last = { at, events, created, moved, cancelled, notes, error: null };
      await this.saveState({ ...(await this.state()), applied: true, last });
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
    return this.apply().catch((e) => { this.log.warn(`Calendar sync: ${(e as Error).message}`); return null; });
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
