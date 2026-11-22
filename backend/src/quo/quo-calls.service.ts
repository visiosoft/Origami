import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadEntity, MeetingEntity, PersonEntity, ProjectEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { MeetingsService } from '../meetings/meetings.service';
import { verifyQuoSignature } from '../sms/opt-out';
import { QuoTasksService } from './quo-tasks.service';
import { phoneKey, prettyPhone } from './quo-tasks';
import { QUO_CALL_EVENTS, QUO_CALL_SOURCE, callIdOf, callMinutes, callTranscript, meetingFromCall, otherNumbers, type DialogueLine, type QuoCall } from './quo-calls';

const KEY_HOOK_ID = 'quo.callsWebhookId';
const KEY_HOOK_SECRET = 'quo.callsWebhookSecret';
const KEY_LAST = 'quo.callsLastEvent';

/**
 * Quo call notes → Meetings (Nov 22). Quo's summary of a call becomes a "Call"
 * meeting (held by phone, already happened) with the summary and next steps,
 * matched to the person (and their project) or lead by phone number; the
 * transcript is added when Quo sends it. One meeting per call, however many
 * times Quo sends its events.
 */
@Injectable()
export class QuoCallsService {
  private readonly log = new Logger('QuoCalls');
  /** Calls being brought in right now: a second event for the same call waits its turn. */
  private inFlight = new Map<string, Promise<unknown>>();

  constructor(
    @InjectRepository(MeetingEntity) private readonly meetings: Repository<MeetingEntity>,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly settings: SettingsService,
    private readonly quo: QuoTasksService,
    private readonly meetingsService: MeetingsService,
  ) {}

  private find(callId: string) {
    return this.meetings.findOne({ where: { sourceType: QUO_CALL_SOURCE, sourceId: callId } as any });
  }

  /** Who the other side is: a person in People (and their one project), else a lead, else the number. */
  private async them(phone: string) {
    const k = phoneKey(phone);
    const person = k ? (await this.people.find()).find((p) => phoneKey(p.phone) === k) : undefined;
    let project: { id: number; name: string } | null = null;
    if (person?.projectIds?.length === 1) {
      const p = await this.projects.findOneBy({ id: person.projectIds[0] } as any);
      if (p) project = { id: p.id, name: p.name };
    }
    const lead = !person && k ? (await this.leads.find()).find((l) => phoneKey(l.phone) === k || phoneKey((l as any).phoneOfSecondContact) === k) : undefined;
    const name = person?.name || (lead ? (lead as any).leadName : '') || '';
    return { name, phone: prettyPhone(phone), personId: person?.id ?? null, project };
  }

  /** Bring one call's summary in (or update it). */
  async syncSummary(callId: string): Promise<{ action: 'created' | 'updated' | 'none'; meetingId?: string }> {
    const c: QuoCall = (await this.quo.quo(`/calls/${encodeURIComponent(callId)}?include=summary`)).data;
    if (!c?.id) return { action: 'none' };
    const s = c.summary;
    if (!s || (s.status && s.status !== 'completed') || (!s.summary?.length && !s.nextSteps?.length)) return { action: 'none' };
    const usId = c.answeredBy || c.initiatedBy || c.actorId || null;
    const odin = await this.quo.odinUserFor(usId).catch(() => null);
    const quoUser = await this.quo.quoUser(usId).catch(() => null);
    const us = odin ? { id: odin.id, name: odin.name, email: odin.email } : quoUser ? { name: quoUser.name, email: quoUser.email } : null;
    const them = await this.them(otherNumbers(c)[0] || '');
    const minutes = callMinutes(s.summary, s.nextSteps, us?.name || '');
    const mine = await this.find(c.id);
    if (mine) {
      if ((mine.minutes || '').trim() && !(mine.minutes || '').includes('Summary from Quo’s call notes.')) return { action: 'none', meetingId: mine.id }; // someone wrote their own notes
      if (mine.minutes === minutes) return { action: 'none', meetingId: mine.id };
      mine.minutes = minutes; mine.updatedAt = new Date().toISOString();
      await this.meetings.save(mine);
      return { action: 'updated', meetingId: mine.id };
    }
    const dto = meetingFromCall(c, { them, us, project: them.project, minutes });
    const m = await this.meetingsService.create(dto as any, us?.id ? { id: us.id, name: us.name } : { name: 'Quo' });
    return { action: 'created', meetingId: m.id };
  }

  /** Add the transcript to the call's meeting (made first from the summary when there isn't one yet). */
  async syncTranscript(callId: string): Promise<{ action: 'updated' | 'none' }> {
    let mine = await this.find(callId);
    if (!mine) { await this.syncSummary(callId).catch(() => undefined); mine = await this.find(callId); }
    if (!mine || (mine.transcript || '').trim()) return { action: 'none' };
    const lines: DialogueLine[] = [];
    let after = '';
    for (let i = 0; i < 10; i++) {
      const r = await this.quo.quo(`/calls/${encodeURIComponent(callId)}/transcripts?limit=50${after ? `&after=${encodeURIComponent(after)}` : ''}`);
      for (const t of r.data || []) lines.push(...(t.dialogue || []));
      after = r.nextCursor || ''; if (!after) break;
    }
    if (!lines.length) return { action: 'none' };
    const names = new Map<string, string>();
    for (const l of lines) {
      const id = l.actorId || l.userId;
      if (id && !names.has(id)) names.set(id, (await this.quo.quoUser(id).catch(() => null))?.name || '');
    }
    const them = mine.title.replace(/^Call with /, '');
    mine.transcript = callTranscript(lines, (l) => { const id = l.actorId || l.userId; return id ? names.get(id) || 'Us' : them; });
    mine.updatedAt = new Date().toISOString();
    await this.meetings.save(mine);
    return { action: 'updated' };
  }

  private once<T>(callId: string, run: () => Promise<T>): Promise<T> {
    const before = this.inFlight.get(callId) || Promise.resolve();
    const next = before.catch(() => undefined).then(run);
    this.inFlight.set(callId, next);
    return next.finally(() => { if (this.inFlight.get(callId) === next) this.inFlight.delete(callId); });
  }

  /** A signed delivery from Quo's call-notes webhook. */
  async webhook(headers: Record<string, any>, raw: string, payload: any) {
    const secret = ((await this.settings.get(KEY_HOOK_SECRET)) || '').trim();
    if (!verifyQuoSignature(headers, raw, secret)) throw new BadRequestException('Signature not valid.');
    const type = String(payload?.type || '');
    const callId = callIdOf(payload);
    if (!callId || !(QUO_CALL_EVENTS as readonly string[]).includes(type)) return { ok: true, action: 'ignored' };
    const r: { action: string } = await this.once<{ action: string }>(callId, () => (type === 'call.transcript.completed' ? this.syncTranscript(callId) : this.syncSummary(callId)));
    await this.settings.set(KEY_LAST, JSON.stringify({ at: new Date().toISOString(), type, callId, action: r.action })).catch(() => undefined);
    return { ok: true, ...r };
  }

  // ------------------------------------------------------------ admin
  private async hookUrl() { return `${(await this.settings.baseUrl()).replace(/\/$/, '')}/api/quo/calls-webhook`; }
  async status() {
    const [hookId, last] = await Promise.all([this.settings.get(KEY_HOOK_ID), this.settings.get(KEY_LAST)]);
    let lastEvent: any = null;
    try { lastEvent = last ? JSON.parse(last) : null; } catch { lastEvent = null; }
    const imported = await this.meetings.count({ where: { sourceType: QUO_CALL_SOURCE } as any });
    return { connected: !!hookId, url: await this.hookUrl(), lastEvent, imported };
  }
  /** Ask Quo to send call summaries and transcripts here (replacing an earlier subscription of ours). */
  async connect() {
    const old = await this.settings.get(KEY_HOOK_ID);
    if (old) await this.quo.quo(`/webhooks/${encodeURIComponent(old)}`, { method: 'DELETE' }).catch(() => undefined);
    const r = await this.quo.quo('/webhooks', { method: 'POST', body: JSON.stringify({ url: await this.hookUrl(), events: [...QUO_CALL_EVENTS], label: 'Origami call notes', resourceIds: ['*'] }) });
    if (!r?.data?.id || !r.data.key) throw new BadRequestException('Quo didn’t return the webhook’s signing key.');
    await this.settings.set(KEY_HOOK_ID, String(r.data.id));
    await this.settings.set(KEY_HOOK_SECRET, String(r.data.key));
    return this.status();
  }
  async disconnect() {
    const old = await this.settings.get(KEY_HOOK_ID);
    if (old) await this.quo.quo(`/webhooks/${encodeURIComponent(old)}`, { method: 'DELETE' }).catch(() => undefined);
    await this.settings.set(KEY_HOOK_ID, '');
    await this.settings.set(KEY_HOOK_SECRET, '');
    return this.status();
  }
  /** Bring one call in by hand (its id from Quo), e.g. a call from before this was switched on. */
  async importCall(callId: string) {
    if (!/^AC[\w-]+$/.test(String(callId || '').trim())) throw new BadRequestException('A Quo call id starts with AC.');
    const id = callId.trim();
    const r = await this.once(id, () => this.syncSummary(id));
    if (r.action !== 'none') await this.once(id, () => this.syncTranscript(id)).catch(() => undefined);
    return r;
  }
}
