import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { RFI_LABEL_MAX, rfiLabel } from './rfi-label';
import { NotifyHub } from '../notifications/notify-hub.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProjectEntity, RfiEntity, UserEntity, type RfiContact, type RfiDrawingRef, type RfiEvent } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { GoogleService } from '../google/google.service';
import { cleanPriority, normalizeAttachments, subId, type TaskAttachment } from '../database/task.types';
import { ManpowerAccess, type Actor } from '../manpower/manpower-access.service';
import { newId } from '../manpower/workforce.util';
import { SettingsService } from '../settings/settings.service';
import { emailShell, loadEmailBrand } from '../email/shell';
import { RFI_DISCIPLINES, rfiDocumentHtml, rfiEmailBody } from './rfi.document';
import { logCounts, rfiLogHtml } from './rfi-log';
import { FileRoomFileEntity, PdfMarkupEntity, PersonEntity } from '../database/entities';
import { appendReport, type ReportItem, type ReportPhoto } from './rfi-drawings';
import { calloutLabel, kindName, numberCallouts, rfiDraftLayer } from './rfi-markups';
import { layerKey } from '../file-room/markups';

export const RFI_MODULE = 'rfis';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
/** YYYY-MM-DD plus n working days (skips weekends) -- the default answer window. */
export function addWorkingDays(from: string, n: number) {
  const d = new Date(`${from}T12:00:00Z`);
  let left = n;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) left--; }
  return d.toISOString().slice(0, 10);
}

/** Text fields a person edits directly; everything else moves through the actions below. */
const EDITABLE = ['shortLabel', 'subject', 'question', 'suggestion', 'discipline', 'specSection', 'drawingRef', 'csiCodeId', 'priority', 'dateDue',
  'costImpact', 'costAmount', 'scheduleImpact', 'scheduleDays', 'answer', 'answeredBy', 'dateAnswered'] as const;

const cleanText = (v: unknown, max = 20000) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const cleanEmail = (v: unknown) => { const e = String(v ?? '').replace(/[\r\n]/g, '').trim(); return EMAIL.test(e) ? e : ''; };
export function cleanContact(c: any): RfiContact | null {
  if (!c) return null;
  const name = cleanText(c.name, 200);
  const email = cleanEmail(c.email);
  if (!name && !email) return null;
  return { name: name || email, ...(email ? { email } : {}), ...(c.company ? { company: cleanText(c.company, 200) } : {}), ...(Number(c.personId) ? { personId: Number(c.personId) } : {}) };
}
const cleanDrawings = (list: unknown): RfiDrawingRef[] =>
  (Array.isArray(list) ? list : []).map((d: any) => ({
    fileId: String(d?.fileId || '').slice(0, 100), name: cleanText(d?.name, 300),
    ...(d?.markupId ? { markupId: String(d.markupId).slice(0, 80) } : {}),
    ...(Number(d?.page) >= 1 ? { page: Math.floor(Number(d.page)) } : {}),
  })).filter((d) => d.fileId && d.name).slice(0, 30);

/** Who has the next move -- shown in the log so nobody has to open each one. */
export function ballInCourt(r: Pick<RfiEntity, 'status' | 'to' | 'ownerName'>) {
  if (r.status === 'open') return r.to?.name || 'Recipient';
  if (r.status === 'draft' || r.status === 'answered') return r.ownerName || 'Us';
  return '';
}

@Injectable()
export class RfisService {
  private readonly log = new Logger('RfisService');

  constructor(
    @InjectRepository(RfiEntity) private readonly repo: Repository<RfiEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly access: ManpowerAccess,
    private readonly google: GoogleService,
    private readonly settings: SettingsService,
    private readonly attachments?: AttachmentsService,
    @Optional() private readonly hub?: NotifyHub,
    @Optional() @InjectRepository(PersonEntity) private readonly people?: Repository<PersonEntity>,
    @Optional() @InjectRepository(PdfMarkupEntity) private readonly markups?: Repository<PdfMarkupEntity>,
    @Optional() @InjectRepository(FileRoomFileEntity) private readonly files?: Repository<FileRoomFileEntity>,
  ) {}

  /**
   * Nov 19 (Edward): the RFI's drawings after its form -- each referenced sheet
   * page with the RFI's markups drawn in, cropped around them. Best effort: the
   * form alone if a drawing can't be read.
   */
  /**
   * Nov 27 (Weekly Sync): after the form, the report -- a table of contents
   * of the RFI's callouts, one cropped page per callout with its number,
   * label and the question, then the photos added in notes.
   */
  private async withDrawings(r: RfiEntity, form: Buffer): Promise<Buffer> {
    if (!this.markups || !this.files) return form;
    try {
      const linked = numberCallouts(await this.markups.find({ where: { linkType: 'rfi', linkId: r.id } as any }));
      const extraIds = [...new Set((r.drawings || []).map((d) => d.markupId).filter((x): x is string => !!x && !linked.some((m) => m.id === x)))];
      const extras = extraIds.length ? await this.markups.find({ where: { id: In(extraIds) } as any }) : [];
      const all = [...linked, ...numberCallouts(extras).map((m) => ({ ...m, n: m.n + linked.length }))].slice(0, 40);
      const draft = layerKey({ layer: rfiDraftLayer(r.number) });
      const bytesOf = new Map<string, Uint8Array | null>();
      const fileOf = new Map<string, FileRoomFileEntity | null>();
      const items: ReportItem[] = [];
      for (const m of all) {
        if (!fileOf.has(m.fileId)) fileOf.set(m.fileId, await this.files.findOneBy({ id: m.fileId }));
        const f = fileOf.get(m.fileId);
        if (!bytesOf.has(m.fileId)) {
          bytesOf.set(m.fileId, f?.driveId && /pdf$/i.test(`${f.ext || ''} ${f.mimeType || ''}`) && Number(f.size || 0) < 60e6 ? await this.google.driveFileBuffer(f.driveId).catch(() => null) : null);
        }
        const bytes = bytesOf.get(m.fileId);
        if (!bytes) continue;
        const sheetName = (f?.sheetNames || {})[String(m.page)];
        items.push({
          n: m.n, kind: kindName(m.kind), label: calloutLabel(m.data), sheet: `${sheetName || f?.name || 'Drawing'} p. ${m.page}`,
          origin: m.authorName || '', status: layerKey(m) === draft ? 'Draft (our team)' : 'On the set',
          bytes, page: m.page, mark: { page: m.page, kind: m.kind, data: m.data as any },
          context: all.filter((x) => x.fileId === m.fileId && x.page === m.page).map((x) => ({ page: x.page, kind: x.kind, data: x.data as any })),
          cacheKey: `${m.fileId}|${m.page}`,
        });
      }
      // Photos added with notes (images only, a dozen at most).
      const byId = new Map(normalizeAttachments(r.attachments).map((a) => [a.id, a]));
      const photos: ReportPhoto[] = [];
      for (const n of r.notes || []) {
        for (const id of n.attachmentIds || []) {
          const a = byId.get(id);
          if (!a?.driveId || !/image\/(jpe?g|png)/i.test(a.mimeType || '') || Number(a.size || 0) > 15e6 || photos.length >= 12) continue;
          const bytes = await this.google.driveFileBuffer(a.driveId).catch(() => null);
          if (bytes) photos.push({ bytes, mimeType: a.mimeType || '', caption: `${a.name} — ${n.by}, ${String(n.at).slice(0, 10)}${n.text ? ` — ${n.text}` : ''}` });
        }
      }
      return Buffer.from(await appendReport(form, { number: r.number, question: r.question, items, photos }));
    } catch (e) {
      this.log.warn(`${r.number} drawings not added to the PDF: ${(e as Error).message}`);
      return form;
    }
  }

  /**
   * Nov 19 (Edward): who the project's RFI Log can go to -- the project team
   * (logins) and the people on the project with an email.
   */
  async logRecipients(projectId: number, actor: Actor) {
    await this.need(actor, 'view');
    const p = await this.projects.findOneBy({ id: projectId });
    if (!p) throw new NotFoundException('Project not found');
    const ids = new Set(Object.values(p.roles || {}));
    const team = (await this.users.find()).filter((u) => ids.has(u.id) && u.email && u.status !== 'suspended').map((u) => ({ name: u.name, email: u.email, kind: 'Team' }));
    const people = ((await this.people?.find().catch(() => [])) || [])
      .filter((x) => (Array.isArray(x.projectIds) && x.projectIds.map(Number).includes(projectId)) || (x.projects || []).includes(p.name))
      .filter((x) => /@/.test(String(x.email || '')))
      .map((x) => ({ name: x.name, email: String(x.email), kind: String(x.kind || 'Contact') }));
    const seen = new Set<string>();
    return [...team, ...people].filter((r) => { const k = r.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  /** The RFI Log as a PDF, emailed to the people picked (Nov 19). */
  async sendLog(projectId: number, dto: { to?: string[]; note?: string }, actor: Actor) {
    await this.need(actor, 'manage');
    const to = [...new Set((Array.isArray(dto?.to) ? dto.to : []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))].slice(0, 60);
    if (!to.length) throw new BadRequestException('Pick at least one person to send it to.');
    if (!(await this.google.isConnected())) throw new BadRequestException('No Google account is connected for sending mail (Settings → Integrations).');
    const p = await this.projects.findOneBy({ id: projectId });
    if (!p) throw new NotFoundException('Project not found');
    const rows = await this.list(actor, projectId);
    const brand = await loadEmailBrand(this.settings);
    const day = today();
    const html = rfiLogHtml(rows as any, p.name, brand.companyName, day);
    const pdf = await this.google.htmlToPdf(html, `RFI Log ${p.name}`);
    const c = logCounts(rows as any, day);
    const note = cleanText(dto?.note, 2000);
    // One email, everyone in Bcc, so recipients don't see each other's addresses.
    await this.google.sendMail({
      to: (await this.settings.get('google.senderEmail')) || (await this.settings.get('google.connectedEmail')) || to[0], bcc: to.join(', '),
      subject: `RFI Log — ${p.name} (${c.open} open${c.overdue ? `, ${c.overdue} overdue` : ''})`,
      html: emailShell({ brand, eyebrow: 'RFI Log', title: p.name, body: `${note ? `<p>${note.replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]!)).replace(/\n/g, '<br>')}</p>` : ''}<p>The project’s RFI Log is attached: ${c.total} RFIs — ${c.open} open${c.overdue ? ` (${c.overdue} overdue)` : ''}, ${c.answered} answered, ${c.closed} closed.</p>`, footer: `Sent by ${actor.name} at ${brand.companyName}.` }),
      attachments: [{ filename: `RFI Log - ${p.name}.pdf`, mimeType: 'application/pdf', content: pdf }],
    });
    return { sent: to.length, ...c };
  }

  /** Nov 17: tell someone an RFI is now theirs (owner set, or sent to them), their way. */
  private async tellAssigned(r: RfiEntity, userIds: (string | null | undefined)[], actor: Actor, why: string) {
    if (!this.hub) return;
    const ids = userIds.filter((x): x is string => !!x);
    if (!ids.length) return;
    void this.hub.deliver(ids, 'rfi_assigned', { title: `${why}: ${r.number}${r.subject ? ` — ${r.subject}` : ''}`, body: r.dateDue ? `Due ${r.dateDue}.` : undefined, path: `/rfis?rfi=${encodeURIComponent(r.id)}`, actorId: actor.id }).catch(() => undefined);
  }
  private async userByEmail(email: string | null | undefined): Promise<string | null> {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return null;
    const u = (await this.users.find()).find((x) => String(x.email || '').toLowerCase() === e || ((x as any).altEmails || []).some((a: string) => String(a).toLowerCase() === e));
    return u?.id || null;
  }

  // ------------------------------------------------------------------ access

  async rights(actor: Actor) {
    const manage = await this.access.can(actor, RFI_MODULE, 'manage');
    const view = manage || (await this.access.can(actor, RFI_MODULE, 'view'));
    return { view, manage };
  }
  private async need(actor: Actor, what: 'view' | 'manage') {
    const r = await this.rights(actor);
    if (!r[what]) throw new ForbiddenException(what === 'view' ? "Your role doesn't include RFIs." : "Your role doesn't allow changing RFIs.");
  }

  // ------------------------------------------------------------------ reading

  private shape(r: RfiEntity) {
    return { ...r, attachments: normalizeAttachments(r.attachments), history: r.history || [], notes: r.notes || [], label: rfiLabel(r), ballInCourt: ballInCourt(r) };
  }

  async list(actor: Actor, projectId?: number) {
    await this.need(actor, 'view');
    const rows = await this.repo.find({ where: projectId ? { projectId } : {}, order: { createdAt: 'DESC' } });
    const names = new Map((await this.projects.find()).map((p) => [Number(p.id), p.name]));
    return rows.map((r) => ({ ...this.shape(r), projectName: names.get(Number(r.projectId)) || `Project ${r.projectId}` }));
  }

  private async load(id: string) {
    const r = await this.repo.findOneBy({ id });
    if (!r) throw new NotFoundException('RFI not found');
    return r;
  }

  async get(id: string, actor: Actor) {
    await this.need(actor, 'view');
    const r = await this.load(id);
    const p = await this.projects.findOneBy({ id: r.projectId });
    return { ...this.shape(r), projectName: p?.name || `Project ${r.projectId}` };
  }

  // ------------------------------------------------------------------ writing

  private event(r: RfiEntity, actor: Actor, action: string, note?: string) {
    const e: RfiEvent = { at: now(), by: actor.name, action, ...(note ? { note } : {}) };
    r.history = [...(r.history || []), e];
  }

  /** Resolve the project from an id, a project name, or the lead id a Request Log task carries. */
  private async projectFrom(dto: any): Promise<ProjectEntity> {
    const id = Number(dto.projectId);
    let p = Number.isFinite(id) && id > 0 ? await this.projects.findOneBy({ id }) : null;
    const ref = cleanText(dto.projectName ?? dto.project, 300);
    if (!p && ref) {
      const all = await this.projects.find();
      p = all.find((x) => x.leadId === ref) || all.find((x) => x.name.trim().toLowerCase() === ref.toLowerCase()) || null;
    }
    if (!p) throw new BadRequestException('Which project is this RFI for?');
    return p;
  }

  private async nextNumber(projectId: number) {
    const rows = await this.repo.find({ where: { projectId } });
    const max = rows.reduce((m, r) => Math.max(m, Number(String(r.number).split('-').pop()) || 0), 0);
    return `RFI-${String(max + 1).padStart(3, '0')}`;
  }

  async create(dto: any, actor: Actor) {
    await this.need(actor, 'manage');
    const project = await this.projectFrom(dto || {});
    const subject = cleanText(dto.subject, 300);
    if (!subject) throw new BadRequestException('Give the RFI a subject.');
    const owner = (dto.ownerId && (await this.users.findOneBy({ id: String(dto.ownerId) }))) || (actor.id ? await this.users.findOneBy({ id: actor.id }) : null);
    let saved: RfiEntity | null = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      const r = this.repo.create({
        id: newId('RFI'), projectId: project.id, number: await this.nextNumber(project.id), subject, status: 'draft',
        question: cleanText(dto.question), suggestion: cleanText(dto.suggestion),
        discipline: RFI_DISCIPLINES.includes(dto.discipline) ? dto.discipline : undefined,
        specSection: cleanText(dto.specSection, 100) || undefined, drawingRef: cleanText(dto.drawingRef, 300) || undefined,
        csiCodeId: cleanText(dto.csiCodeId, 40) || undefined,
        drawings: cleanDrawings(dto.drawings), to: cleanContact(dto.to), cc: (Array.isArray(dto.cc) ? dto.cc : []).map(cleanContact).filter(Boolean) as RfiContact[],
        ownerId: owner?.id, ownerName: owner?.name || actor.name, priority: cleanPriority(dto.priority),
        dateDue: ISO.test(dto.dateDue || '') ? dto.dateDue : undefined,
        sourceTaskId: cleanText(dto.sourceTaskId, 100) || undefined, sourceTaskType: dto.sourceTaskType === 'log' ? 'log' : dto.sourceTaskId ? 'board' : undefined,
        attachments: [], history: [], createdAt: now(), createdBy: actor.name, updatedAt: now(), updatedBy: actor.name,
      });
      this.event(r, actor, dto.sourceTaskId ? 'created from a task' : 'created');
      try { saved = await this.repo.save(r); } catch (e) { if (attempt === 2) throw e; }
    }
    if (saved!.ownerId && saved!.ownerId !== actor.id) await this.tellAssigned(saved!, [saved!.ownerId], actor, 'You own a new RFI');
    return this.get(saved!.id, actor);
  }

  /** Clean and apply the editable fields present in dto. */
  private async applyFields(r: RfiEntity, dto: any, actor: Actor) {
    for (const k of EDITABLE) {
      if (!(k in (dto || {}))) continue;
      const v = dto[k];
      if (k === 'shortLabel') r.shortLabel = cleanText(v, RFI_LABEL_MAX).replace(/\s+/g, ' ') || null;
      else if (k === 'subject') { const s = cleanText(v, 300); if (!s) throw new BadRequestException('The subject can’t be empty.'); r.subject = s; }
      else if (k === 'discipline') r.discipline = RFI_DISCIPLINES.includes(v) ? v : '';
      else if (k === 'priority') r.priority = cleanPriority(v);
      else if (k === 'csiCodeId') r.csiCodeId = cleanText(v, 40) || null;
      else if (k === 'dateDue' || k === 'dateAnswered') (r as any)[k] = ISO.test(v || '') ? v : '';
      else if (k === 'costImpact' || k === 'scheduleImpact') (r as any)[k] = ['none', 'yes', 'tbd'].includes(v) ? v : '';
      else if (k === 'costAmount') r.costAmount = v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100;
      else if (k === 'scheduleDays') r.scheduleDays = v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v)));
      else (r as any)[k] = cleanText(v, k === 'question' || k === 'suggestion' || k === 'answer' ? 20000 : 300);
    }
    if ('to' in (dto || {})) r.to = cleanContact(dto.to);
    if ('cc' in (dto || {})) r.cc = (Array.isArray(dto.cc) ? dto.cc : []).map(cleanContact).filter(Boolean) as RfiContact[];
    if ('drawings' in (dto || {})) r.drawings = cleanDrawings(dto.drawings);
    if ('ownerId' in (dto || {})) {
      const owner = dto.ownerId ? await this.users.findOneBy({ id: String(dto.ownerId) }) : null;
      r.ownerId = owner?.id || ''; r.ownerName = owner?.name || '';
    }
    if ('changeOrderId' in (dto || {})) {
      r.changeOrderId = cleanText(dto.changeOrderId, 100); r.changeOrderNumber = cleanText(dto.changeOrderNumber, 50);
      if (r.changeOrderNumber) this.event(r, actor, `linked to change order ${r.changeOrderNumber}`);
    }
  }

  /** Edit the record. Closed and void RFIs are read-only until reopened. */
  async update(id: string, dto: any, actor: Actor) {
    await this.need(actor, 'manage');
    const r = await this.load(id);
    if (r.status === 'closed' || r.status === 'void') throw new BadRequestException(`${r.number} is ${r.status} — reopen it to make changes.`);
    const ownerBefore = r.ownerId;
    await this.applyFields(r, dto, actor);
    r.updatedAt = now(); r.updatedBy = actor.name;
    await this.repo.save(r);
    if (r.ownerId && r.ownerId !== ownerBefore) await this.tellAssigned(r, [r.ownerId], actor, 'You now own an RFI');
    return this.get(id, actor);
  }

  /** The RFI as a PDF (the same form the email attaches). */
  async pdf(id: string, actor: Actor) {
    await this.need(actor, 'view');
    const r = await this.load(id);
    const project = await this.projects.findOneBy({ id: r.projectId });
    const brand = await loadEmailBrand(this.settings);
    const buffer = await this.withDrawings(r, await this.google.htmlToPdf(rfiDocumentHtml(r, { name: project?.name || '', location: project?.location }, brand.companyName), r.number));
    return { buffer, filename: `${r.number} ${r.subject}`.replace(/[^\w\- ]+/g, '').slice(0, 80) + '.pdf' };
  }

  /**
   * Email it to the recipient (cc's copied, the owner in reply-to so the
   * answer comes back to them) with the PDF attached. A draft becomes open
   * and gets a due date if it had none; an open one is simply re-sent.
   */
  async send(id: string, dto: { note?: string; by?: 'email' | 'notify' }, actor: Actor) {
    await this.need(actor, 'manage');
    const r = await this.load(id);
    if (r.status !== 'draft' && r.status !== 'open') throw new BadRequestException(`${r.number} is ${r.status} — only a draft or an open RFI can be sent.`);
    // Nov 27 (Weekly Sync): "send by" email or by notification -- shared in Odin for someone with a login.
    if (dto?.by === 'notify') {
      const who = await this.userByEmail(r.to?.email);
      if (!who) throw new BadRequestException(`${r.to?.name || 'The recipient'} has no Odin login — send it by email instead.`);
      const whoName = r.to?.name || 'them';
      if (!r.question?.trim()) throw new BadRequestException('Write the question first.');
      const firstShare = r.status === 'draft';
      if (firstShare) { r.dateSent = today(); if (!r.dateDue) r.dateDue = addWorkingDays(r.dateSent, 7); r.status = 'open'; }
      this.event(r, actor, `${firstShare ? 'shared' : 're-shared'} with ${whoName} in Odin (notification)`, cleanText(dto?.note, 500) || undefined);
      r.updatedAt = now(); r.updatedBy = actor.name;
      await this.repo.save(r);
      await this.tellAssigned(r, [who], actor, 'An RFI was shared with you');
      return this.get(id, actor);
    }
    if (!r.to?.email) throw new BadRequestException('Add who it goes to, with an email address.');
    if (!r.question?.trim()) throw new BadRequestException('Write the question first.');
    if (!(await this.google.isConnected())) throw new BadRequestException('No Google account is connected for sending mail (Settings → Integrations).');
    const first = r.status === 'draft';
    if (first) { r.dateSent = today(); if (!r.dateDue) r.dateDue = addWorkingDays(r.dateSent, 7); r.status = 'open'; }

    const project = await this.projects.findOneBy({ id: r.projectId });
    const brand = await loadEmailBrand(this.settings);
    const owner = r.ownerId ? await this.users.findOneBy({ id: r.ownerId }) : null;
    let attachments: { filename: string; mimeType: string; content: Buffer }[] = [];
    try {
      const pdf = await this.withDrawings(r, await this.google.htmlToPdf(rfiDocumentHtml(r, { name: project?.name || '', location: project?.location }, brand.companyName), r.number));
      attachments = [{ filename: `${r.number}.pdf`, mimeType: 'application/pdf', content: pdf }];
    } catch (err) {
      this.log.warn(`${r.number} PDF not attached: ${(err as Error).message}`);
    }
    const cc = [...(r.cc || []).map((c) => c.email).filter(Boolean), owner?.email].filter((e, i, a) => e && e !== r.to!.email && a.indexOf(e) === i) as string[];
    await this.google.sendMail({
      to: r.to.email,
      cc: cc.join(', ') || undefined,
      replyTo: owner?.email || undefined,
      subject: `${r.number}: ${r.subject} — ${project?.name || ''}`.trim(),
      html: emailShell({ brand, eyebrow: `Request for Information · ${r.number}`, title: `Hi ${(r.to.name || '').split(/\s+/)[0] || 'there'},`, body: rfiEmailBody(r, { name: project?.name || '' }, cleanText(dto?.note, 4000)), footer: `Sent by ${owner?.name || actor.name} at ${brand.companyName}. Reply to this email with your answer.` }),
      attachments,
    });
    this.event(r, actor, first ? `sent to ${r.to.name}` : `re-sent to ${r.to.name}`, cleanText(dto?.note, 500) || undefined);
    r.updatedAt = now(); r.updatedBy = actor.name;
    await this.repo.save(r);
    // Nov 17: sent to someone with a login here -- it's on them now.
    await this.tellAssigned(r, [await this.userByEmail(r.to?.email)], actor, 'An RFI was sent to you');
    return this.get(id, actor);
  }

  /**
   * Nov 27 (Weekly Sync): a note or update on the RFI -- text and/or photos,
   * files and sketches already attached to it -- kept in line, like a task's
   * activity, instead of one long description.
   */
  async addNote(id: string, dto: { text?: string; attachmentIds?: string[] }, actor: Actor) {
    await this.need(actor, 'view');
    const r = await this.load(id);
    const text = cleanText(dto?.text, 4000) || '';
    const have = new Set(normalizeAttachments(r.attachments).map((a) => a.id));
    const attachmentIds = [...new Set((Array.isArray(dto?.attachmentIds) ? dto.attachmentIds : []).map(String))].filter((x) => have.has(x)).slice(0, 20);
    if (!text && !attachmentIds.length) throw new BadRequestException('Write the note, or add a photo or file.');
    r.notes = [...(r.notes || []), { id: 'rn-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: now(), by: actor.name, byId: (actor as any).id || null, text, ...(attachmentIds.length ? { attachmentIds } : {}) }];
    r.updatedAt = now(); r.updatedBy = actor.name;
    await this.repo.save(r);
    return this.get(id, actor);
  }

  /** Mark it sent without emailing (sent some other way -- a portal, a meeting). */
  async markSent(id: string, actor: Actor) {
    await this.need(actor, 'manage');
    const r = await this.load(id);
    if (r.status !== 'draft') throw new BadRequestException(`${r.number} has already been sent.`);
    r.status = 'open'; r.dateSent = today(); if (!r.dateDue) r.dateDue = addWorkingDays(r.dateSent, 7);
    this.event(r, actor, 'marked as sent');
    r.updatedAt = now(); r.updatedBy = actor.name;
    await this.repo.save(r);
    return this.get(id, actor);
  }

  /** Record the answer that came back (and, with it, any cost / schedule impact). */
  async answer(id: string, dto: any, actor: Actor) {
    await this.need(actor, 'manage');
    const r = await this.load(id);
    if (r.status !== 'open' && r.status !== 'draft' && r.status !== 'answered') throw new BadRequestException(`${r.number} is ${r.status}.`);
    const text = cleanText(dto?.answer);
    if (!text) throw new BadRequestException('Paste or type the answer.');
    const { costImpact, costAmount, scheduleImpact, scheduleDays } = dto || {};
    await this.applyFields(r, Object.fromEntries(Object.entries({ costImpact, costAmount, scheduleImpact, scheduleDays }).filter(([, v]) => v !== undefined)), actor);
    r.answer = text;
    r.answeredBy = cleanText(dto.answeredBy, 200) || r.to?.name || '';
    r.dateAnswered = ISO.test(dto.dateAnswered || '') ? dto.dateAnswered : today();
    if (!r.dateSent) r.dateSent = r.dateAnswered;
    const first = r.status !== 'answered';
    r.status = 'answered';
    this.event(r, actor, first ? `answer recorded${r.answeredBy ? ` (from ${r.answeredBy})` : ''}` : 'answer updated');
    r.updatedAt = now(); r.updatedBy = actor.name;
    await this.repo.save(r);
    return this.get(id, actor);
  }

  async close(id: string, dto: { note?: string }, actor: Actor) {
    await this.need(actor, 'manage');
    const r = await this.load(id);
    if (r.status === 'closed' || r.status === 'void') return this.get(id, actor);
    if (r.status === 'draft') throw new BadRequestException('Send it (or void it) before closing.');
    r.status = 'closed'; r.dateClosed = today();
    this.event(r, actor, 'closed', cleanText(dto?.note, 500) || undefined);
    r.updatedAt = now(); r.updatedBy = actor.name;
    await this.repo.save(r);
    return this.get(id, actor);
  }

  async reopen(id: string, actor: Actor) {
    await this.need(actor, 'manage');
    const r = await this.load(id);
    if (r.status !== 'closed' && r.status !== 'void') return this.get(id, actor);
    r.status = r.answer ? 'answered' : r.dateSent ? 'open' : 'draft';
    r.dateClosed = ''; r.voidReason = '';
    this.event(r, actor, 'reopened');
    r.updatedAt = now(); r.updatedBy = actor.name;
    await this.repo.save(r);
    return this.get(id, actor);
  }

  async void(id: string, dto: { reason?: string }, actor: Actor) {
    await this.need(actor, 'manage');
    const r = await this.load(id);
    const reason = cleanText(dto?.reason, 1000);
    if (!reason) throw new BadRequestException('Say why it’s being voided.');
    if (r.status === 'void') return this.get(id, actor);
    r.status = 'void'; r.voidReason = reason;
    this.event(r, actor, 'voided', reason);
    r.updatedAt = now(); r.updatedBy = actor.name;
    await this.repo.save(r);
    return this.get(id, actor);
  }

  /** A draft that was never sent can be deleted outright; anything sent is voided instead, so the numbering stays honest. */
  async remove(id: string, actor: Actor) {
    await this.need(actor, 'manage');
    const r = await this.load(id);
    if (r.status !== 'draft' || r.dateSent) throw new BadRequestException(`${r.number} has been sent — void it instead.`);
    for (const a of normalizeAttachments(r.attachments)) await this.attachments?.discard(a).catch(() => undefined);
    await this.repo.remove(r);
    return { id, deleted: true };
  }

  // ------------------------------------------------------------------ attachments

  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const r = await this.load(id);
    const added = await this.attachments!.upload(files, `Project ${r.projectId}`, actor);
    r.attachments = [...normalizeAttachments(r.attachments), ...added];
    await this.repo.save(r);
    return normalizeAttachments(r.attachments);
  }

  async addLink(id: string, name: string, url: string, actor: UploadActor) {
    const r = await this.load(id);
    const att: TaskAttachment = { id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() };
    r.attachments = [...normalizeAttachments(r.attachments), att];
    await this.repo.save(r);
    return normalizeAttachments(r.attachments);
  }

  async removeAttachment(id: string, attId: string) {
    const r = await this.load(id);
    const all = normalizeAttachments(r.attachments);
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('Attachment not found');
    await this.attachments!.discard(target);
    r.attachments = all.filter((a) => a.id !== attId);
    await this.repo.save(r);
    return r.attachments;
  }

  async attachment(id: string, attId: string) {
    const att = normalizeAttachments((await this.load(id)).attachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }
}
