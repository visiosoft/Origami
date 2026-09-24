import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity, ReimbursableEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { normalizeAttachments, subId, type TaskAttachment } from '../database/task.types';
import { newId, todayISO } from '../manpower/workforce.util';
import { assertVersion, FinancialsService } from './financials.service';
import { reimbursableBillC } from './invoices.service';
import { fromCents, roundPct, toCents } from './money';

export const REIMB_CATEGORIES = ['travel', 'printing', 'permits_fees', 'materials', 'consultants', 'shipping', 'equipment', 'other'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const now = () => new Date().toISOString();

/**
 * Reimbursable expenses: submitted with receipts, approved (or rejected), then
 * billed on an invoice at cost plus markup. They sit outside the contract, so
 * they never count as contract work.
 */
@Injectable()
export class ReimbursablesService {
  constructor(
    @InjectRepository(ReimbursableEntity) private readonly repo: Repository<ReimbursableEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly fin: FinancialsService,
    private readonly attachments?: AttachmentsService,
  ) {}

  private async load(id: string) {
    const r = await this.repo.findOneBy({ id });
    if (!r) throw new NotFoundException('Reimbursable not found');
    return r;
  }

  private present(r: ReimbursableEntity) {
    const billC = reimbursableBillC(r);
    return { ...r, attachments: normalizeAttachments(r.attachments), markup: fromCents(billC - toCents(r.cost)), billAmount: fromCents(billC) };
  }

  async list(projectId: number, actor: Actor) {
    await this.fin.need(actor, 'viewReimbursables');
    return (await this.repo.find({ where: { projectId } })).map((r) => this.present(r)).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  }

  async all(actor: Actor) {
    await this.fin.need(actor, 'viewReimbursables');
    const [rows, projects] = await Promise.all([this.repo.find(), this.projects.find()]);
    const name = new Map(projects.map((p) => [p.id, p.name]));
    return rows.map((r) => ({ ...this.present(r), projectName: name.get(r.projectId) || `Project ${r.projectId}` })).sort((a, b) => b.date.localeCompare(a.date));
  }

  async get(id: string, actor: Actor) {
    await this.fin.need(actor, 'viewReimbursables');
    return { ...this.present(await this.load(id)), approvals: await this.fin.approvalsFor(id) };
  }

  private fields(r: ReimbursableEntity, dto: any) {
    if (dto.date !== undefined) { if (!ISO.test(dto.date || '')) throw new BadRequestException('Give the date of the expense.'); r.date = dto.date; }
    if (dto.description !== undefined) { const d = String(dto.description || '').trim(); if (!d) throw new BadRequestException('Describe the expense.'); r.description = d; }
    if (dto.category !== undefined) { if (!REIMB_CATEGORIES.includes(dto.category)) throw new BadRequestException('Unknown category.'); r.category = dto.category; }
    if (dto.cost !== undefined) {
      const c = toCents(dto.cost);
      if (!(c > 0)) throw new BadRequestException('The cost must be more than zero.');
      r.cost = fromCents(c);
    }
    if (dto.markupPct !== undefined) {
      const n = Number(dto.markupPct);
      if (!Number.isFinite(n) || n < 0 || n > 100) throw new BadRequestException('Markup must be between 0 and 100%.');
      r.markupPct = roundPct(n);
    }
    for (const k of ['billable', 'taxable'] as const) if (dto[k] !== undefined) r[k] = !!dto[k];
    for (const k of ['vendor', 'phaseId', 'csiCodeId', 'notes'] as const) if (dto[k] !== undefined) (r as any)[k] = String(dto[k] ?? '').trim() || null;
  }

  async create(projectId: number, dto: any, actor: Actor) {
    await this.fin.need(actor, 'submitReimbursables');
    await this.fin.project(projectId);
    const { value: s } = await this.fin.settingsFor(projectId);
    let saved: ReimbursableEntity | null = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      const r = this.repo.create({
        id: newId('RE'), projectId, number: await this.fin.nextProjectNumber(this.repo, projectId, 'RE'), date: todayISO(), category: 'other',
        markupPct: Number(s.reimbursableMarkupPct) || 0, billable: true, taxable: false, status: 'submitted', submittedBy: actor.name, attachments: [],
        createdAt: now(), createdBy: actor.name,
      } as Partial<ReimbursableEntity>);
      this.fields(r, { date: dto.date || todayISO(), ...dto });
      if (!r.description) throw new BadRequestException('Describe the expense.');
      if (!r.cost) throw new BadRequestException('The cost must be more than zero.');
      try { saved = await this.repo.save(r); } catch (e) { if (attempt === 2) throw e; }
    }
    await this.fin.approval(null, { projectId, entityType: 'reimbursable', entityId: saved!.id, decision: 'submitted', amount: saved!.cost }, actor);
    await this.fin.log(null, { projectId, entityType: 'reimbursable', entityId: saved!.id, action: 'reimbursable_submitted', changes: { cost: { from: null, to: saved!.cost } } }, actor);
    return this.get(saved!.id, actor);
  }

  async update(id: string, dto: any, actor: Actor) {
    const r = await this.load(id);
    const rights = await this.fin.need(actor, 'submitReimbursables');
    if (r.status === 'billed') throw new BadRequestException('It has been billed -- credit the invoice line to correct it.');
    if (r.status === 'approved' && !rights.approveReimbursables) throw new BadRequestException('It has been approved -- ask an approver to change it.');
    assertVersion(r, dto.version);
    const before = { ...r };
    this.fields(r, dto);
    // A rejected expense that is corrected goes back for approval.
    if (r.status === 'rejected') Object.assign(r, { status: 'submitted', rejectedAt: null, rejectedBy: null, rejectedReason: null });
    Object.assign(r, { updatedAt: now(), updatedBy: actor.name });
    await this.repo.save(r);
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ['cost', 'markupPct', 'billable', 'taxable', 'description', 'status'] as const) if (String(before[k] ?? '') !== String(r[k] ?? '')) changes[k] = { from: before[k] ?? null, to: r[k] ?? null };
    await this.fin.log(null, { projectId: r.projectId, entityType: 'reimbursable', entityId: id, action: 'reimbursable_changed', changes }, actor);
    return this.get(id, actor);
  }

  async decide(id: string, dto: { decision: 'approve' | 'reject'; reason?: string; version?: number }, actor: Actor) {
    await this.fin.need(actor, 'approveReimbursables');
    const r = await this.load(id);
    assertVersion(r, dto.version);
    if (r.status !== 'submitted') throw new BadRequestException(`This expense is ${r.status}.`);
    const at = now();
    if (dto.decision === 'approve') Object.assign(r, { status: 'approved', approvedAt: at, approvedBy: actor.name });
    else {
      if (!dto.reason?.trim()) throw new BadRequestException('Say why it’s rejected.');
      Object.assign(r, { status: 'rejected', rejectedAt: at, rejectedBy: actor.name, rejectedReason: dto.reason.trim() });
    }
    Object.assign(r, { updatedAt: at, updatedBy: actor.name });
    await this.repo.save(r);
    await this.fin.approval(null, { projectId: r.projectId, entityType: 'reimbursable', entityId: id, decision: dto.decision === 'approve' ? 'approved' : 'rejected', comment: dto.reason, amount: fromCents(reimbursableBillC(r)) }, actor);
    await this.fin.log(null, { projectId: r.projectId, entityType: 'reimbursable', entityId: id, action: dto.decision === 'approve' ? 'reimbursable_approved' : 'reimbursable_rejected', reason: dto.reason?.trim() }, actor);
    return this.get(id, actor);
  }

  async remove(id: string, actor: Actor) {
    await this.fin.need(actor, 'submitReimbursables');
    const r = await this.load(id);
    if (r.status === 'billed' || r.status === 'approved') throw new BadRequestException('Only an expense that hasn’t been approved can be deleted.');
    await this.repo.remove(r);
    await this.attachments?.discardAll(normalizeAttachments(r.attachments));
    await this.fin.log(null, { projectId: r.projectId, entityType: 'reimbursable', entityId: id, action: 'reimbursable_deleted', changes: { number: { from: r.number, to: null } } }, actor);
    return { id, deleted: true };
  }

  // ------------------------------------------------------------------ receipts

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
