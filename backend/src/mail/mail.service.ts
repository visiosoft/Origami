import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { EmailLinkEntity, LeadEntity, MailTemplateEntity, PersonEntity, ProjectEntity, ProjectTaskEntity, TaskEntity, UserEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { GoogleService, buildMime } from '../google/google.service';
import { openSecret } from '../auth/totp';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';
import { addressesIn, headerOf, messageView, tagsIn, type GmailMessage } from './gmail';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
export type LinkType = 'lead' | 'project' | 'task';
export interface MailDraftInput { to: string; cc?: string; subject: string; html: string; threadId?: string; inReplyTo?: string }
type UploadFile = { originalname: string; mimetype: string; buffer: Buffer };
const now = () => new Date().toISOString();

/**
 * Each person's own Gmail in the app (Nov 13 sync): their inbox and threads
 * (read from Gmail as needed, not copied), replies and new mail with
 * attachments, and threads linked to a lead, project or task -- by hand, by
 * a #tag in the mail, or because a lead wrote it. A linked thread keeps a
 * copy of its messages so everyone who can see that record can read it.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('MailService');
  private tokens = new Map<string, { value: string; expiresAt: number }>();

  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(EmailLinkEntity) private readonly links: Repository<EmailLinkEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly projectTasks: Repository<ProjectTaskEntity>,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    private readonly settings: SettingsService,
    private readonly google: GoogleService,
    private readonly access: ProjectAccessService,
    @Optional() @InjectRepository(MailTemplateEntity) private readonly templatesRepo?: Repository<MailTemplateEntity>,
  ) {}

  // ------------------------------------------------------------ connection
  private async token(userId: string) {
    const hit = this.tokens.get(userId);
    if (hit && hit.expiresAt > Date.now() + 60_000) return hit.value;
    const u = await this.users.findOneBy({ id: userId });
    const refresh = u?.mailRefreshToken ? openSecret(u.mailRefreshToken, await this.settings.jwtSecret()) : null;
    if (!refresh) throw new BadRequestException('Connect your Gmail first.');
    const { clientId, clientSecret } = await this.google.credentials();
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: refresh, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }).toString() });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) { this.log.warn(`Gmail refresh failed for ${userId}: ${body?.error || res.status}`); throw new BadRequestException('Your Gmail connection expired. Connect it again.'); }
    const t = { value: String(body.access_token), expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    this.tokens.set(userId, t);
    return t.value;
  }
  private async gmail(userId: string, path: string, init?: RequestInit) {
    const res = await fetch(`${GMAIL}${path}`, { ...init, headers: { Authorization: `Bearer ${await this.token(userId)}`, ...(init?.headers || {}) } });
    const body: any = res.status === 204 ? {} : await res.json().catch(() => ({}));
    if (!res.ok) throw new BadRequestException(body?.error?.message || `Gmail answered ${res.status}.`);
    return body;
  }

  // ------------------------------------------------------------ reading
  /** A page of threads: newest first, Gmail search syntax in `q`. */
  async threads(userId: string, q = '', pageToken = '', label = 'INBOX') {
    const params = new URLSearchParams({ maxResults: '25' });
    if (q) params.set('q', q);
    if (pageToken) params.set('pageToken', pageToken);
    if (label && !q) params.set('labelIds', label);
    const list = await this.gmail(userId, `/threads?${params}`);
    const ids: string[] = (list.threads || []).map((t: any) => t.id);
    const metas = await Promise.all(ids.map((id) => this.gmail(userId, `/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`).catch(() => null)));
    const linked = ids.length ? await this.links.find({ where: { threadId: In(ids) } }) : [];
    const rows = metas.filter(Boolean).map((t: any) => {
      const msgs: GmailMessage[] = t.messages || [];
      const last = msgs[msgs.length - 1];
      const first = msgs[0];
      return {
        id: t.id, subject: headerOf(first?.payload, 'Subject') || '(no subject)', from: headerOf(last?.payload, 'From'), to: headerOf(last?.payload, 'To'),
        date: last?.internalDate ? new Date(Number(last.internalDate)).toISOString() : '', snippet: last?.snippet || '', count: msgs.length,
        unread: msgs.some((m) => (m.labelIds || []).includes('UNREAD')),
        links: linked.filter((l) => l.threadId === t.id).map((l) => ({ id: l.id, entityType: l.entityType, entityId: l.entityId, label: l.label })),
      };
    });
    return { threads: rows, nextPageToken: list.nextPageToken || null };
  }

  /** One thread, every message; also links it by its #tags or a lead's address, and refreshes linked copies. */
  async thread(userId: string, id: string) {
    const t = await this.gmail(userId, `/threads/${encodeURIComponent(id)}?format=full`);
    const messages = (t.messages || []).map((m: GmailMessage) => messageView(m));
    await this.autoLink(userId, id, messages).catch((e: Error) => this.log.warn(`Auto-link ${id}: ${e.message}`));
    const links = await this.links.find({ where: { threadId: id } });
    for (const l of links.filter((x) => x.ownerId === userId)) { l.messages = this.snapshot(messages); l.lastAt = messages[messages.length - 1]?.date || l.lastAt; l.updatedAt = now(); await this.links.save(l); }
    return { id, subject: messages[0]?.subject || '(no subject)', messages, links: links.map((l) => ({ id: l.id, entityType: l.entityType, entityId: l.entityId, label: l.label, auto: l.auto })) };
  }

  async attachment(userId: string, messageId: string, attachmentId: string) {
    const a = await this.gmail(userId, `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`);
    return Buffer.from(String(a.data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }

  // ------------------------------------------------------------ sending
  /** The message as Gmail wants it (base64url RFC 2822). A draft may have no recipient yet. */
  private async raw(userId: string, dto: MailDraftInput, files: UploadFile[], forDraft = false) {
    const u = await this.users.findOneBy({ id: userId });
    if (!u?.mailEmail) throw new BadRequestException('Connect your Gmail first.');
    const to = addressesIn(dto.to || '').join(', ');
    if (!to && !forDraft) throw new BadRequestException('Who is it to?');
    const subject = String(dto.subject || '').trim() || (forDraft ? '' : '(no subject)');
    let raw = buildMime({ from: u.mailEmail, to, cc: addressesIn(dto.cc || '').join(', ') || undefined, subject, html: String(dto.html || ''), attachments: files.map((f) => ({ filename: f.originalname, mimeType: f.mimetype || 'application/octet-stream', content: f.buffer })) });
    if (dto.inReplyTo) {
      const text = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      const ref = String(dto.inReplyTo).replace(/[\r\n]/g, '');
      raw = Buffer.from(`In-Reply-To: ${ref}\r\nReferences: ${ref}\r\n${text}`, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return raw;
  }

  // ------------------------------------------------------------ drafts (Batch 6): Gmail's own, so they show in Gmail too
  async drafts(userId: string) {
    const list = await this.gmail(userId, '/drafts?maxResults=30');
    const ids: string[] = (list.drafts || []).map((d: any) => d.id);
    const full = await Promise.all(ids.map((id) => this.gmail(userId, `/drafts/${id}?format=metadata`).catch(() => null)));
    return full.filter(Boolean).map((d: any) => ({
      id: d.id, threadId: d.message?.threadId || null, subject: headerOf(d.message?.payload, 'Subject') || '(no subject)',
      to: headerOf(d.message?.payload, 'To'), snippet: d.message?.snippet || '', date: d.message?.internalDate ? new Date(Number(d.message.internalDate)).toISOString() : '',
    }));
  }

  async draft(userId: string, id: string) {
    const d = await this.gmail(userId, `/drafts/${encodeURIComponent(id)}?format=full`);
    const m = messageView(d.message);
    return { id: d.id, threadId: d.message?.threadId || null, to: m.to, cc: m.cc, subject: m.subject, html: m.html || m.text, messageId: m.id, attachments: m.attachments, inReplyTo: headerOf(d.message?.payload, 'In-Reply-To') || null };
  }

  /** Create, or replace (Gmail keeps one message per draft). */
  async saveDraft(userId: string, id: string | null, dto: MailDraftInput, files: UploadFile[] = []) {
    const raw = await this.raw(userId, dto, files, true);
    const body = JSON.stringify({ ...(id ? { id } : {}), message: { raw, ...(dto.threadId ? { threadId: dto.threadId } : {}) } });
    const d = id
      ? await this.gmail(userId, `/drafts/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })
      : await this.gmail(userId, '/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    return { id: d.id, threadId: d.message?.threadId || null };
  }

  async sendDraft(userId: string, id: string, dto: MailDraftInput | null, files: UploadFile[] = []) {
    if (dto) await this.saveDraft(userId, id, dto, files);
    const d = await this.gmail(userId, '/drafts/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    return { id: d.id, threadId: d.threadId };
  }

  async discardDraft(userId: string, id: string) {
    await this.gmail(userId, `/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return { removed: true };
  }

  // ------------------------------------------------------------ templates (Batch 6)
  async templates(userId: string) {
    const rows = (await this.templatesRepo?.find({ order: { name: 'ASC' } })) || [];
    return rows.filter((t) => !t.ownerId || t.ownerId === userId).map((t) => ({ ...t, shared: !t.ownerId, mine: t.ownerId === userId }));
  }

  async saveTemplate(claims: SessionClaims, id: string | null, dto: { name?: string; subject?: string; html?: string; shared?: boolean }) {
    if (!this.templatesRepo) throw new BadRequestException('Templates aren’t available.');
    const name = String(dto?.name || '').trim().slice(0, 200);
    if (!name) throw new BadRequestException('Give the template a name.');
    const existing = id ? await this.templatesRepo.findOneBy({ id }) : null;
    if (id && !existing) throw new NotFoundException('Template not found.');
    const shared = existing ? !existing.ownerId : !!dto?.shared;
    if (shared && claims.roleKey !== 'admin') throw new ForbiddenException('Only administrators change shared templates.');
    if (existing && existing.ownerId && existing.ownerId !== claims.sub) throw new ForbiddenException('That template is someone else’s.');
    const row = this.templatesRepo.create({
      id: existing?.id || 'MTPL-' + randomUUID(), name, subject: String(dto?.subject || '').slice(0, 500) || null, html: String(dto?.html || ''),
      ownerId: shared ? null : claims.sub, ownerName: shared ? null : claims.name || null, updatedAt: now(),
    });
    return this.templatesRepo.save(row);
  }

  async removeTemplate(claims: SessionClaims, id: string) {
    const t = await this.templatesRepo?.findOneBy({ id });
    if (!t) throw new NotFoundException('Template not found.');
    if (!t.ownerId ? claims.roleKey !== 'admin' : t.ownerId !== claims.sub) throw new ForbiddenException('You can’t delete that template.');
    await this.templatesRepo!.delete({ id });
    return { removed: true };
  }

  async send(userId: string, dto: MailDraftInput, files: UploadFile[] = []) {
    const u = await this.users.findOneBy({ id: userId });
    if (!u?.mailEmail) throw new BadRequestException('Connect your Gmail first.');
    const to = addressesIn(dto.to).join(', ');
    if (!to) throw new BadRequestException('Who is it to?');
    const raw = await this.raw(userId, dto, files);
    const sent = await this.gmail(userId, '/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw, ...(dto.threadId ? { threadId: dto.threadId } : {}) }) });
    return { id: sent.id, threadId: sent.threadId };
  }

  /** Addresses to pick from: People and leads with an email (Gmail's own contacts need another permission). */
  async contacts(q: string) {
    const s = String(q || '').trim().toLowerCase();
    if (s.length < 2) return [];
    const people = await this.people.find();
    const leads = await this.leads.find();
    const all = [
      ...people.filter((p) => /@/.test(p.email || '')).map((p) => ({ name: p.name, email: p.email, kind: p.kind })),
      ...leads.filter((l) => /@/.test((l as any).email || '')).map((l) => ({ name: l.leadName, email: (l as any).email, kind: 'Lead' })),
    ];
    return all.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(s)).slice(0, 20);
  }

  // ------------------------------------------------------------ links
  private snapshot(messages: ReturnType<typeof messageView>[]) {
    return messages.slice(-30).map((m) => ({ from: m.from, to: m.to, date: m.date, subject: m.subject, text: m.text.slice(0, 8000), attachments: m.attachments.map((a) => a.filename) }));
  }

  /** May the caller see this record (and so its linked mail)? */
  async canSeeRecord(claims: SessionClaims | null, type: LinkType, id: string): Promise<{ ok: boolean; label: string }> {
    if (!claims) return { ok: false, label: '' };
    if (type === 'project') {
      const p = await this.projects.findOneBy({ id: Number(id) });
      return { ok: !!p && (await this.access.canSee(claims, p.id)), label: p?.name || `Project ${id}` };
    }
    if (type === 'lead') {
      const l = await this.leads.findOneBy({ id });
      return { ok: !!l && this.access.seesClientContacts(claims), label: l?.leadName || id };
    }
    const pt = await this.projectTasks.findOneBy({ id });
    if (pt) return { ok: await this.access.canSee(claims, pt.projectId), label: pt.title };
    const t = await this.tasks.findOneBy({ id });
    return { ok: !!t && this.access.isStaff(claims), label: t?.subject || id };
  }

  async link(claims: SessionClaims, threadId: string, type: LinkType, entityId: string, auto = false) {
    if (!['lead', 'project', 'task'].includes(type)) throw new BadRequestException('Link to a lead, project or task.');
    const rec = await this.canSeeRecord(claims, type, entityId);
    if (!rec.ok) throw new ForbiddenException('You can’t see that record.');
    const exists = await this.links.findOneBy({ threadId, entityType: type, entityId: String(entityId) });
    if (exists) return exists;
    const t = auto ? null : await this.thread(claims.sub, threadId).catch(() => null);
    const again = await this.links.findOneBy({ threadId, entityType: type, entityId: String(entityId) });
    if (again) return again;
    const row = this.links.create({
      id: 'EML-' + randomUUID(), threadId, ownerId: claims.sub, ownerName: claims.name || '', entityType: type, entityId: String(entityId), label: rec.label,
      subject: t?.subject || null, messages: t ? this.snapshot(t.messages) : null, lastAt: t?.messages[t.messages.length - 1]?.date || null, auto, createdAt: now(), updatedAt: now(),
    });
    return this.links.save(row);
  }

  async unlink(claims: SessionClaims, id: string) {
    const l = await this.links.findOneBy({ id });
    if (!l) throw new NotFoundException('Not linked.');
    if (l.ownerId !== claims.sub && claims.roleKey !== 'admin') throw new ForbiddenException('Only the person whose mail it is can unlink it.');
    await this.links.delete({ id });
    return { removed: true };
  }

  /** The mail linked to a record, for everyone who can see the record. */
  async forRecord(claims: SessionClaims | null, type: LinkType, id: string) {
    const rec = await this.canSeeRecord(claims, type, id);
    if (!rec.ok) throw new ForbiddenException('You can’t see that record.');
    const rows = await this.links.find({ where: { entityType: type, entityId: String(id) }, order: { lastAt: 'DESC' } });
    return rows.map((l) => ({ id: l.id, threadId: l.threadId, subject: l.subject, ownerName: l.ownerName, mine: l.ownerId === claims!.sub, auto: l.auto, lastAt: l.lastAt, messages: l.messages || [] }));
  }

  /** #P-45 / #L-x / #<task number> in the mail, or a lead writing, links the thread on its own. */
  private async autoLink(userId: string, threadId: string, messages: ReturnType<typeof messageView>[]) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) return;
    const claims = { sub: user.id, name: user.name, email: user.email, roleKey: user.roleKey, tier: user.tier } as SessionClaims;
    const all = messages.map((m) => `${m.subject}\n${m.text}`).join('\n');
    const tags = tagsIn(all);
    for (const p of tags.projects) await this.link(claims, threadId, 'project', String(p), true).catch(() => undefined);
    for (const l of tags.leads) await this.link(claims, threadId, 'lead', l, true).catch(() => undefined);
    for (const t of tags.tasks) {
      const serial = t.includes('-T-') ? t.slice(t.indexOf('-T-') + 1) : t;
      const pt = (await this.projectTasks.findOneBy({ id: t })) || (await this.projectTasks.findOne({ where: { serial } as any }).catch(() => null));
      const tk = pt ? null : (await this.tasks.findOneBy({ id: t })) || (await this.tasks.findOne({ where: { serial } as any }).catch(() => null));
      const id = pt?.id || tk?.id;
      if (id) await this.link(claims, threadId, 'task', id, true).catch(() => undefined);
    }
    // A lead's own address on the thread links it to that lead.
    const addresses = new Set(messages.flatMap((m) => [...addressesIn(m.from), ...addressesIn(m.to), ...addressesIn(m.cc)]));
    addresses.delete(String(user.mailEmail || '').toLowerCase());
    if (addresses.size && this.access.seesClientContacts(claims)) {
      const leads = (await this.leads.find()).filter((l) => addresses.has(String((l as any).email || '').toLowerCase()));
      for (const l of leads.slice(0, 3)) await this.link(claims, threadId, 'lead', l.id, true).catch(() => undefined);
    }
  }
}
