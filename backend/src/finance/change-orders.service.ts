import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChangeOrderEntity, ChangeOrderItemEntity, ProjectEntity, ProjectPhaseEntity, ProjectSectionEntity, ProjectTaskEntity,
} from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { normalizeAttachments, subId, type TaskAttachment } from '../database/task.types';
import { newId, todayISO } from '../manpower/workforce.util';
import { computeSov, toDollars } from './finance.calc';
import { assertVersion, FinancialsService } from './financials.service';
import { GoogleService } from '../google/google.service';
import { SettingsService } from '../settings/settings.service';
import { emailShell, escapeHtml, loadEmailBrand } from '../email/shell';
import { changeOrderEmailBody, changeOrderHtml } from './co.document';
import { fromCents, sumCents, toCents } from './money';

export const CO_REASONS = ['client_request', 'design_change', 'unforeseen', 'scope_addition', 'scope_reduction', 'allowance', 'code_requirement', 'other'];
const TARGETS = ['phase', 'task', 'new_phase', 'new_task', 'none'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const now = () => new Date().toISOString();
const fmtUsd = (c: number) => (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ItemDto {
  id?: string; description?: string; targetType?: string; phaseId?: string | null; taskId?: string | null; newName?: string;
  amount?: number | string; cost?: number | string | null; quantity?: number | string | null; unit?: string; rate?: number | string | null; csiCodeId?: string;
}

/**
 * Change orders: draft -> internal review -> with the client -> approved
 * (or returned, rejected, cancelled). Only approval touches the contract: the
 * revised contract rises (or falls) by the change order, each item's value by
 * its lines, and any new milestone or task is created on the project then.
 */
@Injectable()
export class ChangeOrdersService {
  constructor(
    @InjectRepository(ChangeOrderEntity) private readonly cos: Repository<ChangeOrderEntity>,
    @InjectRepository(ChangeOrderItemEntity) private readonly items: Repository<ChangeOrderItemEntity>,
    @InjectRepository(ProjectPhaseEntity) private readonly phases: Repository<ProjectPhaseEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly tasks: Repository<ProjectTaskEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly fin: FinancialsService,
    private readonly attachments?: AttachmentsService,
    private readonly google?: GoogleService,
    private readonly settings?: SettingsService,
  ) {}

  /**
   * Email the change order to the client for signature: the signed-off PDF
   * (letterhead, lines, total, signature blocks) attached, a short summary in
   * the body. Goes to the project's bill-to contact unless another address is
   * given; recorded on the approval trail. Only while it's with the client.
   */
  private async emailClient(co: ChangeOrderEntity, dto: { to?: string; cc?: string; note?: string }, actor: Actor) {
    await this.fin.need(actor, 'approveChangeOrders');
    if (co.status !== 'submitted') throw new BadRequestException('Only a change order under client review can be sent to the client.');
    if (!this.google || !(await this.google.isConnected())) throw new BadRequestException('No Google account is connected for sending mail (Settings → Integrations).');
    const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
    const { value: fs } = await this.fin.settingsFor(co.projectId);
    const to = String(dto.to || fs.billToEmail || '').replace(/[\r\n]/g, '').trim();
    if (!EMAIL.test(to)) throw new BadRequestException('Give the client’s email address (or set the bill-to email in the project’s financial settings).');
    const cc = String(dto.cc || '').split(/[,;]/).map((x) => x.replace(/[\r\n]/g, '').trim()).filter((x) => EMAIL.test(x) && x !== to);
    const project = await this.fin.project(co.projectId);
    const doc = this.present(co, await this.items.find({ where: { changeOrderId: co.id } }));
    const brand = await this.fin.brand(actor);
    const pdf = await this.google.htmlToPdf(changeOrderHtml(doc as any, brand, project.name), co.number);
    const note = String(dto.note || '').trim().slice(0, 4000);
    const emailBrand = this.settings ? await loadEmailBrand(this.settings) : { companyName: brand.companyName || 'Origami', accent: '#173326' };
    const first = (fs.billToName || '').split(/\s+/)[0];
    await this.google.sendMail({
      to, cc: cc.join(', ') || undefined,
      subject: `Change order ${co.number} for your signature — ${project.name}`,
      html: emailShell({ brand: emailBrand as any, eyebrow: `Change order · ${co.number}`, title: first ? `Hi ${escapeHtml(first)},` : 'Hello,', body: changeOrderEmailBody(doc as any, project.name, note), footer: `Sent by ${escapeHtml(actor.name)} at ${escapeHtml(emailBrand.companyName)}.` }),
      attachments: [{ filename: `${co.number}.pdf`, mimeType: 'application/pdf', content: pdf }],
    });
    await this.fin.approval(null, { projectId: co.projectId, entityType: 'change_order', entityId: co.id, decision: 'sent_to_client', comment: [`Emailed to ${to}${cc.length ? `, cc ${cc.join(', ')}` : ''}`, note].filter(Boolean).join(' · ') }, actor);
    await this.fin.log(null, { projectId: co.projectId, entityType: 'change_order', entityId: co.id, action: 'co_emailed', changes: { sentTo: { from: null, to } } }, actor);
    return this.get(co.id, actor);
  }

  private async load(id: string) {
    const co = await this.cos.findOneBy({ id });
    if (!co) throw new NotFoundException('Change order not found');
    return co;
  }

  private present(co: ChangeOrderEntity, items: ChangeOrderItemEntity[]) {
    const sorted = items.filter((i) => i.changeOrderId === co.id).sort((a, b) => a.lineOrder - b.lineOrder);
    const liveC = sumCents(sorted.map((i) => toCents(i.amount)));
    const costC = sumCents(sorted.map((i) => toCents(i.cost ?? 0)));
    return {
      ...co, attachments: normalizeAttachments(co.attachments), items: sorted,
      ...toDollars({ totalC: co.status === 'approved' && co.amount != null ? toCents(co.amount) : liveC, costC, marginC: liveC - costC }),
    };
  }

  async list(projectId: number, actor: Actor) {
    await this.fin.need(actor, 'viewChangeOrders');
    const [cos, items] = await Promise.all([this.cos.find({ where: { projectId } }), this.items.find({ where: { projectId } })]);
    return cos.map((c) => this.present(c, items)).sort((a, b) => b.number.localeCompare(a.number));
  }

  /** Every change order across projects -- the change order log. */
  async all(actor: Actor) {
    await this.fin.need(actor, 'viewChangeOrders');
    const [cos, items, projects] = await Promise.all([this.cos.find(), this.items.find(), this.projects.find()]);
    const name = new Map(projects.map((p) => [p.id, p.name]));
    return cos.map((c) => ({ ...this.present(c, items), projectName: name.get(c.projectId) || `Project ${c.projectId}` }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async get(id: string, actor: Actor) {
    await this.fin.need(actor, 'viewChangeOrders');
    const co = await this.load(id);
    const items = await this.items.find({ where: { changeOrderId: id } });
    return { ...this.present(co, items), approvals: await this.fin.approvalsFor(id) };
  }

  // ------------------------------------------------------------------ drafting

  async create(projectId: number, dto: any, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    await this.fin.project(projectId);
    const { row } = await this.fin.settingsFor(projectId);
    if (!row) throw new BadRequestException('Set up this project’s financials (the original contract) before adding change orders.');
    const title = String(dto.title || '').trim();
    if (!title) throw new BadRequestException('Give the change order a title.');
    let co: ChangeOrderEntity | null = null;
    for (let attempt = 0; attempt < 3 && !co; attempt++) {
      const number = await this.fin.nextProjectNumber(this.cos, projectId, 'CO');
      try {
        co = await this.cos.save(this.cos.create({
          id: newId('CO'), projectId, number, title, status: 'draft', reason: CO_REASONS.includes(dto.reason) ? dto.reason : 'client_request',
          requestedBy: dto.requestedBy?.trim() || undefined, dateRequested: ISO.test(dto.dateRequested || '') ? dto.dateRequested : todayISO(),
          description: dto.description?.trim() || undefined, scheduleImpactDays: Number(dto.scheduleImpactDays) || 0, attachments: [], createdAt: now(), createdBy: actor.name,
        }));
      } catch (e) { if (attempt === 2) throw e; }
    }
    if (dto.items?.length) await this.saveItems(co!, dto.items);
    await this.fin.log(null, { projectId, entityType: 'change_order', entityId: co!.id, action: 'co_created', changes: { number: { from: null, to: co!.number } } }, actor);
    return this.get(co!.id, actor);
  }

  private async validItems(co: ChangeOrderEntity, dtos: ItemDto[]) {
    const [phases, tasks] = await Promise.all([this.phases.find({ where: { projectId: co.projectId } }), this.tasks.find({ where: { projectId: co.projectId } })]);
    return dtos.map((d, i) => {
      const description = String(d.description || '').trim();
      if (!description) throw new BadRequestException(`Item ${i + 1}: describe the change.`);
      const targetType = TARGETS.includes(d.targetType || '') ? d.targetType! : 'none';
      const q = d.quantity == null || d.quantity === '' ? null : Number(d.quantity);
      const rate = d.rate == null || d.rate === '' ? null : Number(d.rate);
      const amountC = q != null && rate != null ? Math.round(q * toCents(rate)) : toCents(d.amount as any);
      if (!amountC) throw new BadRequestException(`Item ${i + 1}: give the amount (negative for a deduction).`);
      let phaseId: string | null = null;
      let taskId: string | null = null;
      if (targetType === 'phase' || targetType === 'new_task') {
        if (d.phaseId || targetType === 'phase') {
          if (!phases.some((p) => p.id === d.phaseId)) throw new BadRequestException(`Item ${i + 1}: choose a milestone on this project.`);
          phaseId = d.phaseId!;
        }
      }
      if (targetType === 'task') {
        const t = tasks.find((x) => x.id === d.taskId);
        if (!t) throw new BadRequestException(`Item ${i + 1}: choose a task on this project.`);
        if (t.parentId) throw new BadRequestException(`Item ${i + 1}: change orders go on tasks, not subtasks.`);
        taskId = t.id; phaseId = t.phaseId || null;
      }
      if ((targetType === 'new_phase' || targetType === 'new_task') && !String(d.newName || '').trim()) throw new BadRequestException(`Item ${i + 1}: name the new ${targetType === 'new_phase' ? 'milestone' : 'task'}.`);
      if ((targetType === 'new_phase' || targetType === 'new_task') && amountC < 0) throw new BadRequestException(`Item ${i + 1}: a new item can only add to the contract.`);
      return this.items.create({
        id: d.id && d.id.startsWith('COI') ? d.id : newId('COI'), changeOrderId: co.id, projectId: co.projectId, lineOrder: i, description, targetType,
        phaseId: phaseId as any, taskId: taskId as any, newName: targetType.startsWith('new_') ? String(d.newName).trim() : (undefined as any),
        amount: fromCents(amountC), cost: d.cost == null || d.cost === '' ? null : fromCents(toCents(d.cost as any)), quantity: q, unit: d.unit?.trim() || undefined,
        rate: rate == null ? null : fromCents(toCents(rate)), csiCodeId: d.csiCodeId || undefined, createdAt: now(),
      } as unknown as ChangeOrderItemEntity);
    });
  }

  private async saveItems(co: ChangeOrderEntity, dtos: ItemDto[]) {
    const next = await this.validItems(co, dtos);
    const old = await this.items.find({ where: { changeOrderId: co.id } });
    await this.cos.manager.transaction(async (m) => {
      const gone = old.filter((o) => !next.some((n) => n.id === o.id));
      if (gone.length) await m.getRepository(ChangeOrderItemEntity).remove(gone);
      if (next.length) await m.getRepository(ChangeOrderItemEntity).save(next, { chunk: 40 });
    });
  }

  async update(id: string, dto: any, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    const co = await this.load(id);
    if (co.status !== 'draft') throw new BadRequestException('Only a draft change order can be edited -- return it to draft first.');
    assertVersion(co, dto.version);
    const before = { ...co };
    if (dto.title !== undefined) { const t = String(dto.title || '').trim(); if (!t) throw new BadRequestException('Give the change order a title.'); co.title = t; }
    if (dto.reason !== undefined) { if (!CO_REASONS.includes(dto.reason)) throw new BadRequestException('Unknown reason.'); co.reason = dto.reason; }
    if (dto.dateRequested !== undefined) { if (dto.dateRequested && !ISO.test(dto.dateRequested)) throw new BadRequestException('The request date must be a date.'); co.dateRequested = dto.dateRequested || null as any; }
    if (dto.scheduleImpactDays !== undefined) {
      const n = Number(dto.scheduleImpactDays);
      if (!Number.isInteger(n) || Math.abs(n) > 3650) throw new BadRequestException('Schedule impact is a whole number of days.');
      co.scheduleImpactDays = n;
    }
    for (const k of ['description', 'requestedBy', 'notes'] as const) if (dto[k] !== undefined) (co as any)[k] = String(dto[k] ?? '').trim() || null;
    Object.assign(co, { updatedAt: now(), updatedBy: actor.name });
    if (dto.items) await this.saveItems(co, dto.items);
    await this.cos.save(co);
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ['title', 'reason', 'scheduleImpactDays'] as const) if (String(before[k] ?? '') !== String(co[k] ?? '')) changes[k] = { from: before[k] ?? null, to: co[k] ?? null };
    if (dto.items) changes.items = { from: null, to: dto.items.length };
    await this.fin.log(null, { projectId: co.projectId, entityType: 'change_order', entityId: id, action: 'co_changed', changes }, actor);
    return this.get(id, actor);
  }

  async remove(id: string, actor: Actor) {
    await this.fin.need(actor, 'editChangeOrders');
    const co = await this.load(id);
    if (co.status !== 'draft' || co.submittedAt) throw new BadRequestException('Only a draft that was never submitted can be deleted -- cancel it instead, so the number stays accounted for.');
    await this.cos.manager.transaction(async (m) => {
      await m.getRepository(ChangeOrderItemEntity).delete({ changeOrderId: id });
      await m.getRepository(ChangeOrderEntity).remove(co);
    });
    await this.attachments?.discardAll(normalizeAttachments(co.attachments));
    await this.fin.log(null, { projectId: co.projectId, entityType: 'change_order', entityId: id, action: 'co_deleted', changes: { number: { from: co.number, to: null } } }, actor);
    return { id, deleted: true };
  }

  // ------------------------------------------------------------------ workflow

  async act(id: string, action: string, dto: any, actor: Actor) {
    const co = await this.load(id);
    assertVersion(co, dto.version);
    const at = now();
    const before = co.status;
    const comment = String(dto.comment || dto.reason || '').trim();
    const step = async (decision: string, patch: Partial<ChangeOrderEntity>, logAction: string, reason?: string) => {
      Object.assign(co, patch, { updatedAt: at, updatedBy: actor.name });
      await this.cos.save(co);
      await this.fin.approval(null, { projectId: co.projectId, entityType: 'change_order', entityId: id, decision, comment }, actor);
      await this.fin.log(null, { projectId: co.projectId, entityType: 'change_order', entityId: id, action: logAction, changes: { status: { from: before, to: co.status } }, reason }, actor);
      return this.get(id, actor);
    };
    const need = (...from: string[]) => { if (!from.includes(co.status)) throw new BadRequestException(`This change order is ${co.status.replace('_', ' ')} -- that step doesn't apply.`); };
    switch (action) {
      case 'email_client': return this.emailClient(co, dto || {}, actor);
      case 'submit': {
        await this.fin.need(actor, 'editChangeOrders');
        need('draft');
        if (!(await this.items.count({ where: { changeOrderId: id } }))) throw new BadRequestException('Price at least one item before submitting.');
        return step('submitted', { status: 'internal_review', submittedAt: at, submittedBy: actor.name }, 'co_submitted');
      }
      case 'approve_internal': {
        await this.fin.need(actor, 'approveChangeOrders');
        need('internal_review');
        await this.check(co);
        return step('internal_approved', { status: 'submitted', internalApprovedAt: at, internalApprovedBy: actor.name }, 'co_sent_to_client');
      }
      case 'return': {
        await this.fin.need(actor, 'approveChangeOrders');
        need('internal_review', 'submitted');
        if (!comment) throw new BadRequestException('Say what needs changing.');
        return step('returned', { status: 'draft' }, 'co_returned', comment);
      }
      case 'client_approve': {
        await this.fin.need(actor, 'approveChangeOrders');
        // An approver can record a client-signed change order straight from draft; the approval trail shows it.
        need('draft', 'submitted', 'internal_review');
        const signer = String(dto.signer || '').trim();
        const date = String(dto.date || '').trim() || todayISO();
        if (!signer) throw new BadRequestException('Record who approved it for the client.');
        if (!ISO.test(date)) throw new BadRequestException('Give the date the client approved it.');
        return this.approve(co, { signer, date, reference: String(dto.reference || '').trim(), comment }, actor);
      }
      case 'reject': {
        await this.fin.need(actor, 'approveChangeOrders');
        need('internal_review', 'submitted');
        if (!comment) throw new BadRequestException('Say why it was rejected.');
        return step('rejected', { status: 'rejected', rejectedAt: at, rejectedBy: actor.name, closedReason: comment }, 'co_rejected', comment);
      }
      case 'cancel': {
        await this.fin.need(actor, 'editChangeOrders');
        need('draft', 'internal_review', 'submitted');
        if (!comment) throw new BadRequestException('Say why it’s being cancelled.');
        return step('cancelled', { status: 'cancelled', cancelledAt: at, cancelledBy: actor.name, closedReason: comment }, 'co_cancelled', comment);
      }
      case 'reopen': {
        await this.fin.need(actor, 'editChangeOrders');
        need('rejected');
        return step('reopened', { status: 'draft', closedReason: null as any }, 'co_reopened');
      }
      default: throw new BadRequestException('Unknown step.');
    }
  }

  /**
   * What the schedule of values would look like with this change order
   * approved, and every rule it would break: values below what's invoiced,
   * the contract below contract work invoiced, over-allocation, and changes
   * aimed at an item whose value lives elsewhere (a milestone split into tasks,
   * or a task under a milestone that carries its own value).
   */
  async check(co: ChangeOrderEntity) {
    const items = (await this.items.find({ where: { changeOrderId: co.id } })).sort((a, b) => a.lineOrder - b.lineOrder);
    if (!items.length) throw new BadRequestException('This change order has no items.');
    const ctx = await this.fin.context(co.projectId);
    const input = ctx.input;
    const adjust = new Map(input.coAdjust || []);
    const phases = [...input.phases];
    const tasks = [...input.tasks];
    const keyFor = new Map<string, string>();
    items.forEach((it, i) => {
      let key: string | null = null;
      if (it.targetType === 'phase') {
        if (!phases.some((p) => p.id === it.phaseId)) throw new BadRequestException(`Item ${i + 1}: its milestone no longer exists.`);
        key = `phase:${it.phaseId}`;
      } else if (it.targetType === 'task') {
        if (!tasks.some((t) => t.id === it.taskId)) throw new BadRequestException(`Item ${i + 1}: its task no longer exists.`);
        key = `task:${it.taskId}`;
      } else if (it.targetType === 'new_phase') {
        const id = `NEW-PH-${i}`;
        phases.push({ id, key: `new-${i}`, name: it.newName, order: 9999 + i, category: 'other' });
        key = `phase:${id}`;
      } else if (it.targetType === 'new_task') {
        if (it.phaseId && !phases.some((p) => p.id === it.phaseId)) throw new BadRequestException(`Item ${i + 1}: its milestone no longer exists.`);
        const id = `NEW-T-${i}`;
        tasks.push({ id, title: it.newName, phaseId: it.phaseId || null, done: false, order: 9999 + i });
        key = `task:${id}`;
      }
      if (key) { adjust.set(key, (adjust.get(key) || 0) + toCents(it.amount)); keyFor.set(it.id, key); }
    });
    const totalC = sumCents(items.map((i) => toCents(i.amount)));
    const before = computeSov(input);
    const after = computeSov({ ...input, phases, tasks, coAdjust: adjust, approvedChangesC: input.approvedChangesC + totalC });
    const flatRows = (sov: ReturnType<typeof computeSov>) => sov.groups.flatMap((g) => g.rows.flatMap((r) => [r, ...(r.children || [])]));
    const rows = flatRows(after);
    const beforeRows = flatRows(before);
    const find = (key: string) => rows.find((r) => `${r.kind}:${r.id}` === key);
    items.forEach((it, i) => {
      const key = keyFor.get(it.id);
      if (!key) return;
      const row = find(key);
      if (!row) return;
      if (row.kind === 'phase' && row.valueFromTasks) throw new BadRequestException(`Item ${i + 1}: ${row.name}'s value comes from its tasks -- put the change on a task.`);
      if (row.kind === 'task' && row.phaseId) {
        const parentBefore = beforeRows.find((r) => r.kind === 'phase' && r.id === row.phaseId);
        if (parentBefore && !parentBefore.valueFromTasks && parentBefore.valueC != null) {
          throw new BadRequestException(`Item ${i + 1}: ${parentBefore.name} carries its own value -- put the change on the milestone instead of one of its tasks.`);
        }
      }
      if ((row.valueC ?? 0) < row.invoicedC) throw new BadRequestException(`Item ${i + 1}: ${row.name} would be worth ${fmtUsd(row.valueC ?? 0)} but ${fmtUsd(row.invoicedC)} is already invoiced on it.`);
      if ((row.valueC ?? 0) < 0) throw new BadRequestException(`Item ${i + 1}: ${row.name} can't be worth less than nothing.`);
    });
    const s = after.summary;
    if (s.revisedContractC < s.contractWorkInvoicedC) throw new BadRequestException(`The contract would drop to ${fmtUsd(s.revisedContractC)}, below the ${fmtUsd(s.contractWorkInvoicedC)} of work already invoiced.`);
    if (s.revisedContractC < 0) throw new BadRequestException('The contract can’t go below zero.');
    if (!s.lumpSum && s.allocatedC > s.revisedContractC) throw new BadRequestException(`Allocated values would total ${fmtUsd(s.allocatedC)} against a ${fmtUsd(s.revisedContractC)} contract. Lower item values or add the difference to the change order.`);
    return { totalC, before: before.summary, after: s };
  }

  /** Preview of the approval's effect, for the drawer. */
  async impact(id: string, actor: Actor) {
    await this.fin.need(actor, 'viewChangeOrders');
    const co = await this.load(id);
    try {
      const r = await this.check(co);
      return toDollars({ ok: true, totalC: r.totalC, revisedBeforeC: r.before.revisedContractC, revisedAfterC: r.after.revisedContractC, unallocatedAfterC: r.after.unallocatedC });
    } catch (e: any) {
      return { ok: false, problem: e?.message || 'This change order can’t be approved as it stands.' };
    }
  }

  private async approve(co: ChangeOrderEntity, c: { signer: string; date: string; reference: string; comment: string }, actor: Actor) {
    const { totalC } = await this.check(co);
    const items = (await this.items.find({ where: { changeOrderId: co.id } })).sort((a, b) => a.lineOrder - b.lineOrder);
    const at = now();
    const before = co.status;
    await this.cos.manager.transaction(async (m) => {
      const fresh = await m.getRepository(ChangeOrderEntity).findOne({ where: { id: co.id }, lock: { mode: 'pessimistic_write' } });
      if (!fresh || fresh.status !== before) throw new BadRequestException('This change order changed meanwhile -- reload it.');
      const phaseRepo = m.getRepository(ProjectPhaseEntity);
      const taskRepo = m.getRepository(ProjectTaskEntity);
      const existing = await phaseRepo.find({ where: { projectId: co.projectId } });
      let order = existing.reduce((mx, p) => Math.max(mx, p.order), -1);
      const sections = (await m.getRepository(ProjectSectionEntity).find({ where: { projectId: co.projectId } })).sort((a, b) => a.order - b.order);
      const sectionId = sections[0]?.id ?? `S-${co.projectId}-0`;
      for (const [i, it] of items.entries()) {
        if (it.targetType === 'new_phase') {
          const key = `fin-${Date.now().toString(36)}${i}`;
          const ph = await phaseRepo.save(phaseRepo.create({ id: `PH-${co.projectId}-${key}`, projectId: co.projectId, key, name: it.newName, color: '#7E9B93', order: ++order }));
          it.phaseId = ph.id;
        } else if (it.targetType === 'new_task') {
          const siblings = await taskRepo.find({ where: { projectId: co.projectId } });
          const t = await taskRepo.save(taskRepo.create({
            id: `T-${co.projectId}-co${Date.now().toString(36)}${i}`, projectId: co.projectId, sectionId, phaseId: it.phaseId || undefined, title: it.newName,
            description: `Added by ${co.number}: ${co.title}`, status: 'Not started', completed: false, order: siblings.length + i,
            attachments: [], comments: [], checklist: [], labels: [], activity: [], createdAt: at.slice(0, 10), updatedAt: at,
          } as Partial<ProjectTaskEntity>));
          it.taskId = t.id;
        }
      }
      await m.getRepository(ChangeOrderItemEntity).save(items, { chunk: 40 });
      Object.assign(fresh, {
        status: 'approved', amount: fromCents(totalC), approvedAt: at, approvedBy: actor.name, clientSigner: c.signer, clientApprovedDate: c.date,
        clientReference: c.reference || null, updatedAt: at, updatedBy: actor.name,
        ...(fresh.internalApprovedAt ? {} : { internalApprovedAt: at, internalApprovedBy: actor.name }),
        ...(fresh.submittedAt ? {} : { submittedAt: at, submittedBy: actor.name }),
      });
      await m.getRepository(ChangeOrderEntity).save(fresh);
      await this.fin.approval(m, { projectId: co.projectId, entityType: 'change_order', entityId: co.id, decision: 'client_approved', signer: c.signer, amount: fromCents(totalC), comment: [c.reference, c.comment].filter(Boolean).join(' · ') }, actor);
      await this.fin.log(m, { projectId: co.projectId, entityType: 'change_order', entityId: co.id, action: 'co_approved', changes: { status: { from: before, to: 'approved' }, amount: { from: null, to: fromCents(totalC) } } }, actor);
    });
    return this.get(co.id, actor);
  }

  // ------------------------------------------------------------------ attachments

  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const co = await this.load(id);
    const added = await this.attachments!.upload(files, `Project ${co.projectId}`, actor);
    co.attachments = [...normalizeAttachments(co.attachments), ...added];
    await this.cos.save(co);
    return normalizeAttachments(co.attachments);
  }

  async addLink(id: string, name: string, url: string, actor: UploadActor) {
    const co = await this.load(id);
    const att: TaskAttachment = { id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() };
    co.attachments = [...normalizeAttachments(co.attachments), att];
    await this.cos.save(co);
    return normalizeAttachments(co.attachments);
  }

  async removeAttachment(id: string, attId: string) {
    const co = await this.load(id);
    const all = normalizeAttachments(co.attachments);
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('Attachment not found');
    await this.attachments!.discard(target);
    co.attachments = all.filter((a) => a.id !== attId);
    await this.cos.save(co);
    return co.attachments;
  }

  async attachment(id: string, attId: string) {
    const att = normalizeAttachments((await this.load(id)).attachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }
}

