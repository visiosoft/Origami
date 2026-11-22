import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonEntity, TaskEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { TasksService } from '../tasks/tasks.service';
import { emailsOf } from '../common/emails';
import { verifyQuoSignature } from '../sms/opt-out';
import { QUO_ACTOR, QUO_API, QUO_TASK_EVENTS, QUO_VERSION, eventTypeOf, phoneKey, prettyPhone, taskIdOf, toLogTask, type QuoOrigin, type QuoTask } from './quo-tasks';

const KEY_HOOK_ID = 'quo.tasksWebhookId';
const KEY_HOOK_SECRET = 'quo.tasksWebhookSecret';
const KEY_LAST = 'quo.tasksLastEvent';

/**
 * Quo tasks ↔ ODIN tasks (D6, Nov 15). Every Quo task comes in as a Request
 * Log task (origin "Quo, text from … to … on …"), assigned to the ODIN user
 * with the Quo assignee's email. Both ways: done or reopened in ODIN changes
 * it in Quo; completed, reopened, deleted or edited in Quo changes ODIN.
 */
@Injectable()
export class QuoTasksService implements OnModuleInit {
  private readonly log = new Logger('QuoTasks');
  private quoUsers: { at: number; byId: Map<string, { email: string; name: string }> } | null = null;

  constructor(
    @InjectRepository(TaskEntity) private readonly logTasks: Repository<TaskEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    private readonly settings: SettingsService,
    private readonly tasks: TasksService,
  ) {}

  onModuleInit() {
    // Closed or reopened in ODIN (by a person, not by this sync): the same in Quo.
    this.tasks.onStatusChange(async (t, change, actor) => {
      if (t.sourceType !== 'quo' || !t.sourceId || actor?.id === QUO_ACTOR.id) return;
      await this.quo(`/tasks/${encodeURIComponent(t.sourceId)}/status`, { method: 'PATCH', body: JSON.stringify({ status: change === 'closed' ? 'completed' : 'open' }) })
        .catch((e: Error) => this.log.warn(`Quo task ${t.sourceId} → ${change}: ${e.message}`));
    });
  }

  // ------------------------------------------------------------ Quo API
  private async key() {
    const k = ((await this.settings.get('sms.quoApiKey')) || '').trim();
    if (!k) throw new BadRequestException('Add the Quo API key first (Settings → Text messages).');
    return k;
  }
  async quo(path: string, init: RequestInit = {}) {
    const res = await fetch(`${QUO_API}${path}`, { ...init, headers: { Authorization: await this.key(), 'Quo-Api-Version': QUO_VERSION, 'Content-Type': 'application/json', ...(init.headers || {}) } });
    const body: any = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new BadRequestException(body?.message || `Quo answered ${res.status}.`), { quoStatus: res.status });
    return body;
  }
  async quoUser(id: string | null | undefined) {
    if (!id) return null;
    if (!this.quoUsers || Date.now() - this.quoUsers.at > 10 * 60_000) {
      const byId = new Map<string, { email: string; name: string }>();
      let after = '';
      for (let i = 0; i < 20; i++) {
        const r = await this.quo(`/users?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
        for (const u of r.data || []) byId.set(u.id, { email: String(u.email || '').toLowerCase(), name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '' });
        after = r.nextCursor || ''; if (!after) break;
      }
      this.quoUsers = { at: Date.now(), byId };
    }
    return this.quoUsers.byId.get(id) || null;
  }
  /** The ODIN user with the Quo user's email (main or other). */
  async odinUserFor(quoUserId: string | null | undefined) {
    const q = await this.quoUser(quoUserId);
    if (!q?.email) return null;
    const all = await this.users.find();
    return all.find((u) => u.status !== 'suspended' && emailsOf(u).includes(q.email)) || null;
  }
  /** A number's name: the Quo user, a person in People, else the number. */
  private async nameForPhone(phone: string, users: Map<string, string>) {
    const k = phoneKey(phone);
    if (!k) return '';
    const p = (await this.people.find()).find((x) => phoneKey(x.phone) === k);
    return p?.name || users.get(k) || prettyPhone(phone);
  }
  private async origin(t: QuoTask): Promise<QuoOrigin | null> {
    if (!t.activityId) return null;
    const userName = async (id?: string | null) => (id ? (await this.quoUser(id))?.name || '' : '');
    try {
      const m = (await this.quo(`/messages/${encodeURIComponent(t.activityId)}`)).data;
      if (m?.id) {
        const inbound = m.direction === 'incoming';
        const other = inbound ? m.from : (Array.isArray(m.to) ? m.to[0] : m.to);
        const them = await this.nameForPhone(other, new Map());
        const us = (await userName(m.userId)) || 'us';
        return { kind: 'text', from: inbound ? them : us, to: inbound ? us : them, at: m.createdAt || null, text: m.text || null };
      }
    } catch { /* not a message */ }
    try {
      const c = (await this.quo(`/calls/${encodeURIComponent(t.activityId)}`)).data;
      if (c?.id) {
        const inbound = c.direction === 'incoming';
        const other = (c.participants || [])[0] || '';
        const them = await this.nameForPhone(other, new Map());
        const us = (await userName(c.answeredBy || c.initiatedBy || c.actorId)) || 'us';
        return { kind: 'call', from: inbound ? them : us, to: inbound ? us : them, at: c.createdAt || null, text: c.summary?.summary?.join?.(' ') || null };
      }
    } catch { /* neither */ }
    return null;
  }

  // ------------------------------------------------------------ Quo → ODIN
  private async findLog(taskId: string) {
    return this.logTasks.findOne({ where: { sourceType: 'quo', sourceId: taskId } as any });
  }

  /** Bring one Quo task into ODIN: create it, or bring the ODIN task up to date. */
  async sync(taskId: string): Promise<{ action: 'created' | 'updated' | 'closed' | 'reopened' | 'none' }> {
    let t: QuoTask | null = null;
    try { t = (await this.quo(`/tasks/${encodeURIComponent(taskId)}`)).data; }
    catch (e: any) { if (e?.quoStatus === 404) t = { taskId, status: 'deleted' }; else throw e; }
    if (!t) return { action: 'none' };
    const mine = await this.findLog(taskId);
    if (!mine) {
      if (t.status !== 'open') return { action: 'none' };
      const assignee = await this.odinUserFor(t.assignedTo);
      const creator = await this.quoUser(t.createdBy);
      await this.tasks.create(toLogTask(t, { origin: await this.origin(t), assigneeId: assignee?.id || null, createdByName: creator?.name || null }), QUO_ACTOR);
      return { action: 'created' };
    }
    const statuses = ['Complete', 'Confirmed'];
    const closedHere = statuses.includes(mine.status) || !!mine.closedAt;
    if (t.status !== 'open' && !closedHere) {
      await this.tasks.update(mine.id, { status: 'Complete', completionNote: t.status === 'deleted' ? 'Deleted in Quo.' : 'Completed in Quo.' }, QUO_ACTOR);
      return { action: 'closed' };
    }
    if (t.status === 'open' && closedHere) {
      await this.tasks.update(mine.id, { status: mine.assignedToId ? 'Assigned' : 'To Do' }, QUO_ACTOR);
      return { action: 'reopened' };
    }
    if (t.status !== 'open') return { action: 'none' };
    // Edited in Quo: title, notes, due date, assignee.
    const assignee = await this.odinUserFor(t.assignedTo);
    const patch: Record<string, unknown> = {};
    const title = String(t.title || '').trim();
    if (title && title !== mine.subject) patch.subject = title.slice(0, 250);
    const due = t.dueDate ? String(t.dueDate).slice(0, 10) : '';
    if (due !== (mine.dueDate || '')) patch.dueDate = due;
    if ((assignee?.id || null) !== (mine.assignedToId || null) && (assignee || t.assignedTo == null)) patch.assignedToId = assignee?.id || null;
    if (!Object.keys(patch).length) return { action: 'none' };
    await this.tasks.update(mine.id, patch, QUO_ACTOR);
    return { action: 'updated' };
  }

  /** A signed delivery from Quo's task webhook. */
  async webhook(headers: Record<string, any>, raw: string, payload: unknown) {
    const secret = ((await this.settings.get(KEY_HOOK_SECRET)) || '').trim();
    if (!verifyQuoSignature(headers, raw, secret)) throw new BadRequestException('Signature not valid.');
    const type = eventTypeOf(payload);
    const id = taskIdOf(payload);
    if (!id || (type && !type.startsWith('task.'))) return { ok: true, action: 'ignored' };
    const r = await this.sync(id);
    await this.settings.set(KEY_LAST, JSON.stringify({ at: new Date().toISOString(), type, taskId: id, action: r.action })).catch(() => undefined);
    return { ok: true, ...r };
  }

  // ------------------------------------------------------------ admin
  async status() {
    const [hookId, last, key] = await Promise.all([this.settings.get(KEY_HOOK_ID), this.settings.get(KEY_LAST), this.settings.get('sms.quoApiKey')]);
    let lastEvent: any = null;
    try { lastEvent = last ? JSON.parse(last) : null; } catch { lastEvent = null; }
    const imported = await this.logTasks.count({ where: { sourceType: 'quo' } as any });
    return { hasKey: !!(key || '').trim(), connected: !!hookId, webhookId: hookId || null, url: await this.hookUrl(), lastEvent, imported };
  }
  private async hookUrl() { return `${(await this.settings.baseUrl()).replace(/\/$/, '')}/api/quo/tasks-webhook`; }

  /** Ask Quo to send task events here (replacing an earlier subscription of ours). */
  async connect() {
    const old = await this.settings.get(KEY_HOOK_ID);
    if (old) await this.quo(`/webhooks/${encodeURIComponent(old)}`, { method: 'DELETE' }).catch(() => undefined);
    const r = await this.quo('/webhooks', { method: 'POST', body: JSON.stringify({ url: await this.hookUrl(), events: [...QUO_TASK_EVENTS], label: 'ODIN tasks', resourceIds: ['*'] }) });
    if (!r?.data?.id || !r.data.key) throw new BadRequestException('Quo didn’t return the webhook’s signing key.');
    await this.settings.set(KEY_HOOK_ID, String(r.data.id));
    await this.settings.set(KEY_HOOK_SECRET, String(r.data.key));
    return this.status();
  }
  async disconnect() {
    const old = await this.settings.get(KEY_HOOK_ID);
    if (old) await this.quo(`/webhooks/${encodeURIComponent(old)}`, { method: 'DELETE' }).catch(() => undefined);
    await this.settings.set(KEY_HOOK_ID, '');
    await this.settings.set(KEY_HOOK_SECRET, '');
    return this.status();
  }

  /** Open Quo tasks not in ODIN yet: shown before anything is imported. */
  async preview() {
    const open: QuoTask[] = [];
    let after = '';
    for (let i = 0; i < 40; i++) {
      const r = await this.quo(`/tasks?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
      open.push(...((r.data || []) as QuoTask[]).filter((t) => t.status === 'open'));
      after = r.nextCursor || ''; if (!after) break;
    }
    const have = new Set((await this.logTasks.find({ where: { sourceType: 'quo' } as any, select: { sourceId: true } as any })).map((t) => t.sourceId));
    const rows = [];
    for (const t of open.filter((x) => !have.has(x.taskId))) {
      const a = await this.odinUserFor(t.assignedTo);
      rows.push({ taskId: t.taskId, title: t.title || '(no title)', dueDate: t.dueDate || null, createdAt: t.createdAt || null, assignee: a?.name || null, quoAssignee: (await this.quoUser(t.assignedTo))?.name || null });
    }
    return { open: open.length, toImport: rows };
  }

  /** Import the previewed tasks (or the ones named). */
  async importOpen(taskIds?: string[]) {
    const p = await this.preview();
    const ids = p.toImport.map((r) => r.taskId).filter((id) => !taskIds?.length || taskIds.includes(id));
    let created = 0; const failed: { taskId: string; error: string }[] = [];
    for (const id of ids) {
      try { if ((await this.sync(id)).action === 'created') created++; }
      catch (e) { failed.push({ taskId: id, error: (e as Error).message.slice(0, 200) }); }
    }
    return { created, failed };
  }
}
