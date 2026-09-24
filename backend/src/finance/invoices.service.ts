import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  FinanceSequenceEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, ReimbursableEntity,
  RetentionReleaseEntity,
} from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { normalizeAttachments, subId, type TaskAttachment } from '../database/task.types';
import { newId, todayISO } from '../manpower/workforce.util';
import { computeSov, invoiceTotals, isContractWork, lineMath, toDollars, type SovRow } from './finance.calc';
import { assertVersion, FinancialsService } from './financials.service';
import { fromCents, pctOf, roundPct, sumCents, toCents } from './money';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LINE_KINDS = ['progress', 'manual', 'adjustment', 'reimbursable', 'retention_release'];
export const PAYMENT_METHODS = ['ach', 'check', 'wire', 'card', 'cash', 'other'];
const now = () => new Date().toISOString();
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const fmtUsd = (c: number) => (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface LineDto {
  id?: string; kind: string; targetType?: string | null; phaseId?: string | null; taskId?: string | null; description?: string;
  amount?: number | string | null; currentProgressPct?: number | string | null; quantity?: number | string | null; unit?: string | null; rate?: number | string | null;
  retentionApplies?: boolean; taxable?: boolean; reimbursableId?: string | null; retentionReleaseId?: string | null;
}

/** The billable items of a project's SOV, flattened: lump sum, milestones billed as a whole, tasks and unphased tasks. */
export function billableItems(sov: ReturnType<typeof computeSov>) {
  const out: SovRow[] = [];
  if (sov.lump) out.push(sov.lump);
  for (const g of sov.groups) for (const r of g.rows) {
    if (r.kind === 'phase') { if (r.valueFromTasks) out.push(...(r.children || []).filter((c) => c.valueC != null)); else if (r.valueC != null) out.push(r); }
    else out.push(r);
  }
  return out;
}
export const itemKey = (x: { targetType?: string | null; kind?: string; phaseId?: string | null; taskId?: string | null; id?: string }) =>
  x.targetType === 'project' || x.kind === 'project' ? 'project' : x.taskId ? `task:${x.taskId}` : x.phaseId ? `phase:${x.phaseId}` : (x.kind === 'task' ? `task:${x.id}` : `phase:${x.id}`);

/** Cost plus markup, in cents: what a reimbursable bills. */
export const reimbursableBillC = (r: { cost: number; markupPct: number }) => toCents(r.cost) + pctOf(toCents(r.cost), Number(r.markupPct) || 0);

/** What the line builder needs besides the SOV: the project's reimbursables and retention releases. */
interface BuildRefs { reimbs: Map<string, ReimbursableEntity>; releases: Map<string, RetentionReleaseEntity> }

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(ProjectInvoiceEntity) private readonly invoices: Repository<ProjectInvoiceEntity>,
    @InjectRepository(ProjectInvoiceLineEntity) private readonly lines: Repository<ProjectInvoiceLineEntity>,
    @InjectRepository(ProjectPaymentEntity) private readonly payments: Repository<ProjectPaymentEntity>,
    @InjectRepository(ProjectFinancialEntity) private readonly pfin: Repository<ProjectFinancialEntity>,
    private readonly fin: FinancialsService,
    @InjectRepository(ReimbursableEntity) private readonly reimbs: Repository<ReimbursableEntity>,
    @InjectRepository(RetentionReleaseEntity) private readonly releases: Repository<RetentionReleaseEntity>,
    private readonly attachments?: AttachmentsService,
  ) {}

  // ------------------------------------------------------------------ reading

  private async load(id: string) {
    const inv = await this.invoices.findOneBy({ id });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  private totalsOf(lines: ProjectInvoiceLineEntity[]) {
    return invoiceTotals(lines.map((l) => ({ kind: l.kind, amountC: toCents(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })));
  }

  /**
   * Totals (live for drafts, the issue snapshot otherwise), paid, credited,
   * outstanding and payment status. Credit notes owe nothing themselves; they
   * reduce what the invoice they credit owes.
   */
  private present(inv: ProjectInvoiceEntity, lines: ProjectInvoiceLineEntity[], pays: ProjectPaymentEntity[], credits: ProjectInvoiceEntity[] = []) {
    const live = this.totalsOf(lines);
    const t = inv.status === 'draft' ? live : {
      ...live, contractWorkC: toCents(inv.contractWork), retentionC: toCents(inv.retentionAmount), adjustmentC: toCents(inv.adjustmentTotal), taxC: toCents(inv.taxAmount), totalC: toCents(inv.total),
    };
    const isCredit = inv.kind === 'credit';
    const creditedC = !isCredit && inv.status === 'issued' ? sumCents(credits.filter((c) => c.status === 'issued').map((c) => toCents(c.total))) : 0;
    const paidC = !isCredit && inv.status === 'issued' ? sumCents(pays.filter((p) => !p.voidedAt).map((p) => toCents(p.amount))) : 0;
    const outstandingC = !isCredit && inv.status === 'issued' ? t.totalC + creditedC - paidC : 0;
    const overdue = outstandingC > 0 && !!inv.dueDate && inv.dueDate < todayISO();
    const paymentStatus = inv.status === 'draft' ? 'draft' : inv.status === 'void' ? 'void' : isCredit ? 'credit'
      : outstandingC < 0 ? 'credit_balance' : outstandingC === 0 ? 'paid' : overdue ? 'overdue' : paidC > 0 || creditedC ? 'partially_paid' : 'unpaid';
    return {
      ...inv, ...toDollars({ ...t, paidC, creditedC, outstandingC }), paymentStatus, overdue, attachments: normalizeAttachments(inv.attachments),
      credits: credits.map((c) => ({ id: c.id, issuedNumber: c.issuedNumber, status: c.status, creditType: c.creditType, total: c.total, invoiceDate: c.invoiceDate })),
    };
  }

  async list(projectId: number, actor: Actor) {
    await this.fin.need(actor, 'view');
    const [invs, lines, pays] = await Promise.all([
      this.invoices.find({ where: { projectId } }), this.lines.find({ where: { projectId } }), this.payments.find({ where: { projectId } }),
    ]);
    return invs.map((inv) => this.present(inv, lines.filter((l) => l.invoiceId === inv.id), pays.filter((p) => p.invoiceId === inv.id), invs.filter((c) => c.creditForInvoiceId === inv.id)))
      .sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async get(id: string, actor: Actor) {
    await this.fin.need(actor, 'view');
    const inv = await this.load(id);
    const [lines, pays, credits, forInv] = await Promise.all([
      this.lines.find({ where: { invoiceId: id } }), this.payments.find({ where: { invoiceId: id } }),
      this.invoices.find({ where: { creditForInvoiceId: id } }),
      inv.creditForInvoiceId ? this.invoices.findOneBy({ id: inv.creditForInvoiceId }) : Promise.resolve(null),
    ]);
    const sorted = lines.sort((a, b) => a.lineOrder - b.lineOrder);
    return {
      ...this.present(inv, sorted, pays, credits),
      lines: sorted.map((l) => ({ ...l, ...toDollars(lineMath({ kind: l.kind, amountC: toCents(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })) })),
      payments: pays.sort((a, b) => a.date.localeCompare(b.date)),
      creditFor: forInv ? { id: forInv.id, issuedNumber: forInv.issuedNumber } : null,
      approvals: await this.fin.approvalsFor(id),
    };
  }

  async projectPayments(projectId: number, actor: Actor) {
    await this.fin.need(actor, 'view');
    const [pays, invs] = await Promise.all([this.payments.find({ where: { projectId } }), this.invoices.find({ where: { projectId } })]);
    const num = new Map(invs.map((i) => [i.id, i.issuedNumber]));
    return pays.map((p) => ({ ...p, invoiceNumber: num.get(p.invoiceId) })).sort((a, b) => b.date.localeCompare(a.date));
  }

  private async refs(projectId: number, m?: EntityManager): Promise<BuildRefs> {
    const [r, rr] = await Promise.all([
      (m ? m.getRepository(ReimbursableEntity) : this.reimbs).find({ where: { projectId } }),
      (m ? m.getRepository(RetentionReleaseEntity) : this.releases).find({ where: { projectId } }),
    ]);
    return { reimbs: new Map(r.map((x) => [x.id, x])), releases: new Map(rr.map((x) => [x.id, x])) };
  }

  // ------------------------------------------------------------------ drafts

  /**
   * A draft from selected items (or everything ready to bill: earned-but-unbilled
   * work and approved reimbursables), each progress line claiming what the item
   * has earned but not yet billed.
   */
  async createDraft(projectId: number, dto: { items?: { kind: string; id: string }[]; billReady?: boolean; kind?: string; description?: string; reimbursableIds?: string[] }, actor: Actor) {
    await this.fin.need(actor, 'prepareInvoice');
    const { row: s } = await this.fin.settingsFor(projectId);
    if (!s) throw new BadRequestException('Set up this project’s financials (contract value, retention, tax) before invoicing.');
    const ctx = await this.fin.context(projectId);
    const sov = computeSov(ctx.input);
    const items = billableItems(sov);
    const refs = await this.refs(projectId);
    const standard = dto.kind === 'standard';
    const wanted = standard ? [] : (dto.billReady || !dto.items?.length
      ? (dto.items?.length || !dto.reimbursableIds?.length ? items : [])
      : items.filter((r) => dto.items!.some((x) => itemKey({ kind: x.kind, id: x.id }) === itemKey({ kind: r.kind, id: r.id })))).filter((r) => r.billableC > 0);
    const readyReimbs = Array.from(refs.reimbs.values()).filter((r) => r.status === 'approved' && r.billable && !r.invoiceId);
    const reimbs = dto.reimbursableIds?.length ? readyReimbs.filter((r) => dto.reimbursableIds!.includes(r.id)) : dto.billReady ? readyReimbs : [];
    if (!standard && !wanted.length && !reimbs.length) {
      throw new BadRequestException('Nothing is ready to invoice: no item has earned more than has been billed, and no approved reimbursable is waiting. Update progress first, or start a standard invoice for manual items.');
    }
    const today = todayISO();
    const inv = this.invoices.create({
      id: newId('PI'), projectId, kind: standard ? 'standard' : 'progress', status: 'draft', invoiceDate: today,
      dueDate: addDays(today, s.paymentTermsDays ?? 30), currency: s.currency || 'USD', fxRate: 1, baseCurrency: 'USD',
      reference: s.contractNumber, poNumber: s.poNumber, description: dto.description, billToName: s.billToName, billToEmail: s.billToEmail, billToAddress: s.billToAddress,
      retentionPct: s.retentionPct, taxPct: s.taxPct, attachments: [], createdAt: now(), createdBy: actor.name,
    });
    const lineDtos: LineDto[] = [
      ...wanted.map((r) => ({
        kind: 'progress', targetType: r.kind, phaseId: r.kind === 'phase' ? r.id : r.kind === 'task' ? r.phaseId : null, taskId: r.kind === 'task' ? r.id : null,
        description: r.name, amount: fromCents(r.billableC),
      })),
      ...reimbs.map((r) => ({ kind: 'reimbursable', reimbursableId: r.id })),
    ];
    const built = this.buildLines(inv, lineDtos, sov, refs);
    await this.invoices.manager.transaction(async (m) => {
      await m.getRepository(ProjectInvoiceEntity).save(inv);
      if (built.length) await m.getRepository(ProjectInvoiceLineEntity).save(built, { chunk: 40 });
    });
    await this.fin.log(null, { projectId, entityType: 'invoice', entityId: inv.id, action: 'invoice_drafted', changes: { lines: { from: null, to: built.length } } }, actor);
    return this.get(inv.id, actor);
  }

  /**
   * Turn line input into stored lines with their effective retention and tax,
   * and the progress snapshot as things stand now (refreshed again at issue).
   */
  private buildLines(inv: ProjectInvoiceEntity, dtos: LineDto[], sov: ReturnType<typeof computeSov>, refs: BuildRefs): ProjectInvoiceLineEntity[] {
    const items = new Map(billableItems(sov).map((r) => [itemKey({ kind: r.kind, id: r.id }), r]));
    const claimed = new Map<string, number>();
    const released = new Map<string, number>(); // per item
    const perRelease = new Map<string, number>();
    const reimbSeen = new Set<string>();
    return dtos.map((d, i) => {
      if (!LINE_KINDS.includes(d.kind)) throw new BadRequestException('Unknown line type.');
      const base: Partial<ProjectInvoiceLineEntity> = {
        id: d.id && d.id.startsWith('PL') ? d.id : newId('PL'), invoiceId: inv.id, projectId: inv.projectId, kind: d.kind, lineOrder: i,
        description: String(d.description || '').trim(), unit: d.unit || undefined,
      };
      let amountC: number;
      let retPct = Number(inv.retentionPct) || 0;
      let taxPct = Number(inv.taxPct) || 0;
      let taxableDefault = taxPct > 0;
      let retentionApplies = d.retentionApplies ?? true;
      if (d.kind === 'progress') {
        const key = itemKey({ targetType: d.targetType, kind: d.targetType || undefined, phaseId: d.phaseId, taskId: d.taskId });
        const item = items.get(key);
        if (!item || !item.valueC) throw new BadRequestException(`Line ${i + 1}: that item has no value to bill against.`);
        const prevC = item.invoicedC;
        amountC = d.currentProgressPct != null && d.currentProgressPct !== ''
          ? pctOf(item.valueC, roundPct(Number(d.currentProgressPct))) - prevC
          : toCents(d.amount as any);
        const already = claimed.get(key) || 0;
        if (amountC <= 0) throw new BadRequestException(`Line ${i + 1}: the claim must be more than zero.`);
        if (prevC + already + amountC > item.valueC) {
          throw new BadRequestException(`Line ${i + 1} (${item.name}): only ${fmtUsd(item.valueC - prevC - already)} is left to invoice on it.`);
        }
        claimed.set(key, already + amountC);
        retPct = item.fin?.retentionPctOverride != null ? Number(item.fin.retentionPctOverride) : retPct;
        taxPct = item.fin?.taxPctOverride != null ? Number(item.fin.taxPctOverride) : taxPct;
        taxableDefault = taxPct > 0;
        Object.assign(base, {
          targetType: item.kind, phaseId: item.kind === 'phase' ? item.id : item.kind === 'task' ? item.phaseId || null : null, taskId: item.kind === 'task' ? item.id : null,
          description: base.description || item.name, billingMethod: item.fin?.billingMethod || 'percent_complete',
          contractValue: fromCents(item.valueC), prevBilled: fromCents(prevC + already),
          prevProgressPct: roundPct(((prevC + already) / item.valueC) * 100), currentProgressPct: roundPct(((prevC + already + amountC) / item.valueC) * 100),
        });
      } else if (d.kind === 'manual') {
        const q = d.quantity == null || d.quantity === '' ? null : Number(d.quantity);
        const rate = d.rate == null || d.rate === '' ? null : Number(d.rate);
        amountC = q != null && rate != null ? Math.round(q * toCents(rate)) : toCents(d.amount as any);
        if (!base.description) throw new BadRequestException(`Line ${i + 1}: describe the item.`);
        if (amountC <= 0) throw new BadRequestException(`Line ${i + 1}: the amount must be more than zero.`);
        Object.assign(base, { quantity: q, rate: rate == null ? null : fromCents(toCents(rate)), billingMethod: 'manual' });
      } else if (d.kind === 'reimbursable') {
        const r = d.reimbursableId ? refs.reimbs.get(d.reimbursableId) : undefined;
        if (!r || r.projectId !== inv.projectId) throw new BadRequestException(`Line ${i + 1}: that reimbursable isn't on this project.`);
        if (!r.billable) throw new BadRequestException(`Line ${i + 1}: ${r.number} is marked not billable.`);
        if (r.status !== 'approved' || (r.invoiceId && r.invoiceId !== inv.id)) {
          throw new BadRequestException(`Line ${i + 1}: ${r.number} is ${r.status === 'billed' ? 'already billed' : 'not approved yet'}.`);
        }
        if (reimbSeen.has(r.id)) throw new BadRequestException(`${r.number} is on this invoice twice.`);
        reimbSeen.add(r.id);
        amountC = reimbursableBillC(r);
        retentionApplies = false;
        taxableDefault = !!r.taxable;
        const markup = Number(r.markupPct) || 0;
        Object.assign(base, {
          reimbursableId: r.id, billingMethod: 'reimbursable', quantity: null, rate: null,
          description: base.description || `${r.number} ${r.description}${markup ? ` (cost ${fmtUsd(toCents(r.cost))} + ${markup}% markup)` : ''}`,
        });
      } else if (d.kind === 'retention_release') {
        const rel = d.retentionReleaseId ? refs.releases.get(d.retentionReleaseId) : undefined;
        if (!rel || rel.projectId !== inv.projectId) throw new BadRequestException(`Line ${i + 1}: that retention release isn't on this project.`);
        if (rel.status !== 'approved' || rel.invoiceId !== inv.id) throw new BadRequestException(`Line ${i + 1}: ${rel.number} isn't an approved release billed on this invoice.`);
        const key = itemKey({ targetType: d.targetType, kind: d.targetType || undefined, phaseId: d.phaseId, taskId: d.taskId });
        const item = items.get(key);
        if (!item) throw new BadRequestException(`Line ${i + 1}: that item holds no retention.`);
        amountC = toCents(d.amount as any);
        if (amountC <= 0) throw new BadRequestException(`Line ${i + 1}: the release must be more than zero.`);
        const already = released.get(key) || 0;
        if (already + amountC > item.retentionC) throw new BadRequestException(`Line ${i + 1} (${item.name}): only ${fmtUsd(item.retentionC - already)} of retention is held on it.`);
        released.set(key, already + amountC);
        const relSoFar = (perRelease.get(rel.id) || 0) + amountC;
        if (relSoFar > toCents(rel.amount)) throw new BadRequestException(`${rel.number} releases ${fmtUsd(toCents(rel.amount))} -- the lines add up to more.`);
        perRelease.set(rel.id, relSoFar);
        retentionApplies = false;
        Object.assign(base, {
          retentionReleaseId: rel.id, targetType: item.kind, phaseId: item.kind === 'phase' ? item.id : item.kind === 'task' ? item.phaseId || null : null,
          taskId: item.kind === 'task' ? item.id : null, billingMethod: 'retention', description: base.description || `Retention released — ${item.name}`,
        });
      } else {
        amountC = toCents(d.amount as any);
        if (!base.description) throw new BadRequestException(`Line ${i + 1}: say what the adjustment is for.`);
        if (!amountC) throw new BadRequestException(`Line ${i + 1}: an adjustment needs an amount (negative for a discount).`);
        retentionApplies = false;
        taxableDefault = false;
      }
      if (!isContractWork(d.kind)) retentionApplies = false;
      const taxable = d.taxable ?? taxableDefault;
      const m = lineMath({ kind: d.kind, amountC, retentionApplies, retentionPct: retPct, taxable, taxPct });
      return this.lines.create({
        ...base, amount: fromCents(amountC), retentionApplies, retentionPct: retentionApplies ? retPct : 0,
        retentionAmount: fromCents(m.retentionC), taxable, taxPct: taxable ? taxPct : 0, taxAmount: fromCents(m.taxC),
      } as ProjectInvoiceLineEntity);
    });
  }

  /** The retention invoice for an approved release; the release is tied to the draft until it's issued or deleted. */
  async createReleaseDraft(rel: RetentionReleaseEntity, dtos: LineDto[], actor: Actor) {
    await this.fin.need(actor, 'prepareInvoice');
    const { row: s } = await this.fin.settingsFor(rel.projectId);
    if (!s) throw new BadRequestException('Set up this project’s financials first.');
    if (!dtos.length) throw new BadRequestException('No retention is held there now.');
    const today = todayISO();
    const inv = this.invoices.create({
      id: newId('PI'), projectId: rel.projectId, kind: 'retention', status: 'draft', invoiceDate: today, dueDate: addDays(today, s.paymentTermsDays ?? 30),
      currency: s.currency || 'USD', fxRate: 1, baseCurrency: 'USD', reference: s.contractNumber, poNumber: s.poNumber, description: `Retention release ${rel.number}`,
      billToName: s.billToName, billToEmail: s.billToEmail, billToAddress: s.billToAddress, retentionPct: s.retentionPct, taxPct: s.taxPct, attachments: [],
      createdAt: now(), createdBy: actor.name,
    });
    const refs = await this.refs(rel.projectId);
    const mine = refs.releases.get(rel.id);
    if (!mine || mine.invoiceId) throw new BadRequestException('This release is already on an invoice.');
    mine.invoiceId = inv.id;
    const built = this.buildLines(inv, dtos, computeSov((await this.fin.context(rel.projectId)).input), refs);
    await this.invoices.manager.transaction(async (m) => {
      await m.getRepository(ProjectInvoiceEntity).save(inv);
      await m.getRepository(ProjectInvoiceLineEntity).save(built, { chunk: 40 });
      await m.getRepository(RetentionReleaseEntity).update({ id: rel.id }, { invoiceId: inv.id, updatedAt: now(), updatedBy: actor.name });
    });
    await this.fin.log(null, { projectId: rel.projectId, entityType: 'invoice', entityId: inv.id, action: 'invoice_drafted', changes: { release: { from: null, to: rel.number } } }, actor);
    return this.get(inv.id, actor);
  }

  /** Stored lines back into builder input, keeping what each line points at. */
  private asDtos(old: ProjectInvoiceLineEntity[]): LineDto[] {
    return old.sort((a, b) => a.lineOrder - b.lineOrder).map((l) => ({
      id: l.id, kind: l.kind, targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId, description: l.description,
      amount: l.amount, quantity: l.quantity, unit: l.unit, rate: l.rate, retentionApplies: l.retentionApplies, taxable: l.taxable,
      reimbursableId: l.reimbursableId, retentionReleaseId: l.retentionReleaseId,
    }));
  }

  async updateDraft(id: string, dto: any, actor: Actor) {
    await this.fin.need(actor, 'prepareInvoice');
    const inv = await this.load(id);
    if (inv.status !== 'draft') throw new BadRequestException('Only a draft can be edited. Issued invoices are permanent -- void and reissue, or issue a credit note, to correct one.');
    if (inv.kind === 'credit' && dto.lines) throw new BadRequestException('A credit note’s lines are set when it’s created -- delete it and start again to change them.');
    assertVersion(inv, dto.version);
    const before = { ...inv };
    for (const k of ['invoiceDate', 'dueDate', 'periodStart', 'periodEnd'] as const) {
      if (dto[k] !== undefined) {
        if (dto[k] && !ISO.test(dto[k])) throw new BadRequestException(`${k} must be a date.`);
        (inv as any)[k] = dto[k] || null;
      }
    }
    if (!inv.invoiceDate) throw new BadRequestException('The invoice needs a date.');
    if (inv.dueDate && inv.dueDate < inv.invoiceDate) throw new BadRequestException('The due date is before the invoice date.');
    for (const k of ['reference', 'poNumber', 'description', 'billToName', 'billToEmail', 'billToAddress', 'notes'] as const) if (dto[k] !== undefined) (inv as any)[k] = String(dto[k] ?? '').trim() || null;
    if (inv.kind !== 'credit') {
      for (const k of ['retentionPct', 'taxPct'] as const) {
        if (dto[k] !== undefined) {
          const n = Number(dto[k]);
          if (!Number.isFinite(n) || n < 0 || n > 100) throw new BadRequestException(`${k === 'taxPct' ? 'Tax' : 'Retention'} must be between 0 and 100.`);
          inv[k] = roundPct(n);
        }
      }
    }
    Object.assign(inv, { updatedAt: now(), updatedBy: actor.name });
    const old = await this.lines.find({ where: { invoiceId: id } });
    let next = old;
    if (inv.kind !== 'credit') {
      const sov = computeSov((await this.fin.context(inv.projectId)).input);
      next = this.buildLines(inv, dto.lines ? dto.lines : this.asDtos(old), sov, await this.refs(inv.projectId));
    }
    // A release taken off the draft is free to be billed elsewhere.
    const droppedReleases = old.filter((o) => o.retentionReleaseId && !next.some((n) => n.retentionReleaseId === o.retentionReleaseId)).map((o) => o.retentionReleaseId);
    await this.invoices.manager.transaction(async (m) => {
      await m.getRepository(ProjectInvoiceEntity).save(inv);
      const gone = old.filter((o) => !next.some((n) => n.id === o.id));
      if (gone.length) await m.getRepository(ProjectInvoiceLineEntity).remove(gone);
      if (next.length && next !== old) await m.getRepository(ProjectInvoiceLineEntity).save(next, { chunk: 40 });
      if (droppedReleases.length) await m.getRepository(RetentionReleaseEntity).update({ id: In(Array.from(new Set(droppedReleases))), invoiceId: id }, { invoiceId: null as any });
    });
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ['invoiceDate', 'dueDate', 'retentionPct', 'taxPct', 'billToName', 'poNumber'] as const) if (String(before[k] ?? '') !== String(inv[k] ?? '')) changes[k] = { from: before[k] ?? null, to: inv[k] ?? null };
    if (dto.lines) changes.lines = { from: old.length, to: next.length };
    await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_draft_changed', changes }, actor);
    return this.get(id, actor);
  }

  async removeDraft(id: string, actor: Actor) {
    await this.fin.need(actor, 'prepareInvoice');
    const inv = await this.load(id);
    if (inv.status !== 'draft') throw new BadRequestException('Issued invoices are never deleted -- void it instead.');
    await this.invoices.manager.transaction(async (m) => {
      await m.getRepository(ProjectInvoiceLineEntity).delete({ invoiceId: id });
      await m.getRepository(RetentionReleaseEntity).update({ invoiceId: id, status: 'approved' }, { invoiceId: null as any });
      await m.getRepository(ProjectInvoiceEntity).remove(inv);
    });
    await this.attachments?.discardAll(normalizeAttachments(inv.attachments));
    await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_draft_deleted' }, actor);
    return { id, deleted: true };
  }

  /** Someone who can prepare but not issue asks for it to be issued. */
  async requestApproval(id: string, dto: { version?: number; comment?: string }, actor: Actor) {
    await this.fin.need(actor, 'prepareInvoice');
    const inv = await this.load(id);
    if (inv.status !== 'draft') throw new BadRequestException('Only a draft goes for approval.');
    assertVersion(inv, dto.version);
    if (!(await this.lines.count({ where: { invoiceId: id } }))) throw new BadRequestException('Add at least one line first.');
    Object.assign(inv, { approvalRequestedAt: now(), approvalRequestedBy: actor.name, updatedAt: now(), updatedBy: actor.name });
    await this.invoices.save(inv);
    await this.fin.approval(null, { projectId: inv.projectId, entityType: inv.kind === 'credit' ? 'credit_note' : 'invoice', entityId: id, decision: 'submitted', comment: dto.comment }, actor);
    await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_approval_requested', reason: dto.comment }, actor);
    return this.get(id, actor);
  }

  /** The approver sends a draft back with a comment instead of issuing it. */
  async returnDraft(id: string, dto: { version?: number; comment?: string }, actor: Actor) {
    await this.fin.need(actor, 'issueInvoice');
    const inv = await this.load(id);
    if (inv.status !== 'draft' || !inv.approvalRequestedAt) throw new BadRequestException('This draft isn’t waiting for approval.');
    assertVersion(inv, dto.version);
    if (!dto.comment?.trim()) throw new BadRequestException('Say what needs changing.');
    Object.assign(inv, { approvalRequestedAt: null, approvalRequestedBy: null, updatedAt: now(), updatedBy: actor.name });
    await this.invoices.save(inv);
    await this.fin.approval(null, { projectId: inv.projectId, entityType: inv.kind === 'credit' ? 'credit_note' : 'invoice', entityId: id, decision: 'returned', comment: dto.comment }, actor);
    return this.get(id, actor);
  }

  // ------------------------------------------------------------------ issuing

  /** The next document number, taken under an update lock so two issues can never share one. */
  async nextNumber(m: EntityManager, year: number, prefix = 'INV') {
    const repo = m.getRepository(FinanceSequenceEntity);
    const id = `${prefix}-${year}`;
    let seq = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!seq) {
      try { await repo.insert({ id, next: 1 }); } catch { /* someone created it first */ }
      seq = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    }
    const n = seq!.next;
    await repo.update({ id }, { next: n + 1 });
    return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
  }

  /**
   * Make a draft a permanent invoice (or credit note). Inside one transaction,
   * and after taking the numbering lock (which serialises issues), every line is
   * re-checked against what is billed now, snapshotted, and the totals frozen.
   */
  async issue(id: string, dto: { version?: number }, actor: Actor) {
    await this.fin.need(actor, 'issueInvoice');
    const draft = await this.load(id);
    if (draft.status !== 'draft') throw new BadRequestException(`This invoice is already ${draft.status}.`);
    assertVersion(draft, dto.version);
    if (draft.kind === 'credit') return this.issueCredit(draft, dto, actor);
    const issuedId = await this.invoices.manager.transaction(async (m) => {
      const number = await this.nextNumber(m, Number((draft.invoiceDate || todayISO()).slice(0, 4)));
      const inv = await m.getRepository(ProjectInvoiceEntity).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!inv || inv.status !== 'draft') throw new BadRequestException('This invoice was issued or removed meanwhile.');
      assertVersion(inv, dto.version);
      const old = await m.getRepository(ProjectInvoiceLineEntity).find({ where: { invoiceId: id } });
      if (!old.length) throw new BadRequestException('Add at least one line before issuing.');
      // Re-price against what has been issued up to this moment (another invoice may have gone out since the draft).
      const sov = computeSov((await this.fin.context(inv.projectId)).input);
      const refs = await this.refs(inv.projectId, m);
      const lines = this.buildLines(inv, this.asDtos(old), sov, refs);
      const t = this.totalsOf(lines);
      // Contract work (pre-tax) may never exceed the contract.
      if (sov.summary.contractWorkInvoicedC + t.contractWorkC > sov.summary.revisedContractC) {
        throw new BadRequestException(`This would bring contract work invoiced to ${fmtUsd(sov.summary.contractWorkInvoicedC + t.contractWorkC)} on a ${fmtUsd(sov.summary.revisedContractC)} contract. Only ${fmtUsd(Math.max(sov.summary.revisedContractC - sov.summary.contractWorkInvoicedC, 0))} is left.`);
      }
      if (t.totalC < 0) throw new BadRequestException('The invoice total can’t be negative -- use a credit note to reduce an earlier invoice.');
      Object.assign(inv, {
        status: 'issued', issuedNumber: number, issuedAt: now(), issuedById: actor.id, issuedByName: actor.name, updatedAt: now(), updatedBy: actor.name,
        contractWork: fromCents(t.contractWorkC), retentionAmount: fromCents(t.retentionC), adjustmentTotal: fromCents(t.adjustmentC), taxAmount: fromCents(t.taxC), total: fromCents(t.totalC),
      });
      await m.getRepository(ProjectInvoiceLineEntity).save(lines, { chunk: 40 });
      await m.getRepository(ProjectInvoiceEntity).save(inv);
      // Reimbursables and retention releases on it are now billed.
      const reimbIds = lines.filter((l) => l.reimbursableId).map((l) => l.reimbursableId);
      if (reimbIds.length) await m.getRepository(ReimbursableEntity).update({ id: In(reimbIds) }, { status: 'billed', invoiceId: id, updatedAt: now(), updatedBy: actor.name });
      const relIds = Array.from(new Set(lines.filter((l) => l.retentionReleaseId).map((l) => l.retentionReleaseId)));
      if (relIds.length) await m.getRepository(RetentionReleaseEntity).update({ id: In(relIds) }, { status: 'billed', invoiceId: id, updatedAt: now(), updatedBy: actor.name });
      const s = await m.getRepository(ProjectFinancialEntity).findOneBy({ projectId: inv.projectId });
      if (s && !s.contractLockedAt && t.contractWorkC > 0) { s.contractLockedAt = now(); s.updatedAt = now(); s.updatedBy = actor.name; await m.getRepository(ProjectFinancialEntity).save(s); }
      await this.fin.log(m, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_issued', changes: { number: { from: null, to: number }, total: { from: null, to: fromCents(t.totalC) } } }, actor);
      await this.fin.approval(m, { projectId: inv.projectId, entityType: 'invoice', entityId: id, decision: inv.approvalRequestedAt ? 'approved' : 'issued', amount: fromCents(t.totalC), comment: number }, actor);
      return inv.id;
    });
    return this.get(issuedId, actor);
  }

  /** Cancel an issued invoice that has nothing paid or credited against it; it stops counting everywhere but stays on record. */
  async void(id: string, dto: { reason?: string; version?: number }, actor: Actor) {
    await this.fin.need(actor, 'issueInvoice');
    const inv = await this.load(id);
    if (inv.status !== 'issued') throw new BadRequestException(inv.status === 'draft' ? 'Delete a draft instead of voiding it.' : 'This invoice is already void.');
    assertVersion(inv, dto.version);
    if (!dto.reason?.trim()) throw new BadRequestException('Say why the invoice is being voided.');
    const live = (await this.payments.find({ where: { invoiceId: id } })).filter((p) => !p.voidedAt);
    if (live.length) throw new BadRequestException(`${live.length} payment(s) are recorded against this invoice -- void them first.`);
    const credits = (await this.invoices.find({ where: { creditForInvoiceId: id } })).filter((c) => c.status !== 'void');
    if (credits.length) throw new BadRequestException(`Credit note ${credits.map((c) => c.issuedNumber || 'draft').join(', ')} is against this invoice -- void or delete it first.`);
    Object.assign(inv, { status: 'void', voidedAt: now(), voidedById: actor.id, voidedByName: actor.name, voidReason: dto.reason.trim(), updatedAt: now(), updatedBy: actor.name });
    await this.invoices.manager.transaction(async (m) => {
      await m.getRepository(ProjectInvoiceEntity).save(inv);
      // Whatever it billed can be billed again.
      await m.getRepository(ReimbursableEntity).update({ invoiceId: id, status: 'billed' }, { status: 'approved', invoiceId: null as any, updatedAt: now(), updatedBy: actor.name });
      await m.getRepository(RetentionReleaseEntity).update({ invoiceId: id, status: 'billed' }, { status: 'approved', invoiceId: null as any, updatedAt: now(), updatedBy: actor.name });
    });
    await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: inv.kind === 'credit' ? 'credit_voided' : 'invoice_voided', changes: { status: { from: 'issued', to: 'void' } }, reason: dto.reason.trim() }, actor);
    return this.get(id, actor);
  }

  // ------------------------------------------------------------------ credit notes and write-offs

  /** Credit left on each line of an invoice: its amount less what issued credit notes have already taken off it. */
  private async creditRoom(invoiceId: string, m?: EntityManager) {
    const repoI = m ? m.getRepository(ProjectInvoiceEntity) : this.invoices;
    const repoL = m ? m.getRepository(ProjectInvoiceLineEntity) : this.lines;
    const credits = (await repoI.find({ where: { creditForInvoiceId: invoiceId } })).filter((c) => c.status === 'issued');
    const creditLines = credits.length ? await repoL.find({ where: { invoiceId: In(credits.map((c) => c.id)) } }) : [];
    const taken = new Map<string, number>();
    for (const l of creditLines) if (l.creditsLineId) taken.set(l.creditsLineId, (taken.get(l.creditsLineId) || 0) - toCents(l.amount));
    return taken;
  }

  private async owedC(inv: ProjectInvoiceEntity, m?: EntityManager) {
    const repoI = m ? m.getRepository(ProjectInvoiceEntity) : this.invoices;
    const repoP = m ? m.getRepository(ProjectPaymentEntity) : this.payments;
    const credits = (await repoI.find({ where: { creditForInvoiceId: inv.id } })).filter((c) => c.status === 'issued');
    const paid = sumCents((await repoP.find({ where: { invoiceId: inv.id } })).filter((p) => !p.voidedAt).map((p) => toCents(p.amount)));
    return toCents(inv.total) + sumCents(credits.map((c) => toCents(c.total))) - paid;
  }

  /**
   * A credit note against an issued invoice. A credit reverses part of what was
   * billed, line by line (retention and tax reversed at the line's own rates),
   * so the work is billable again. A write-off clears an unpaid balance as a
   * loss without un-billing any work.
   */
  async createCredit(invoiceId: string, dto: { creditType?: string; reason?: string; amount?: number | string; lines?: { lineId: string; amount: number | string }[] }, actor: Actor) {
    await this.fin.need(actor, 'issueInvoice');
    const orig = await this.load(invoiceId);
    if (orig.status !== 'issued' || orig.kind === 'credit') throw new BadRequestException('Credit notes go against an issued invoice.');
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('Say why the credit is being given.');
    const writeOff = dto.creditType === 'write_off';
    const origLines = await this.lines.find({ where: { invoiceId } });
    const cn = this.invoices.create({
      id: newId('PI'), projectId: orig.projectId, kind: 'credit', status: 'draft', invoiceDate: todayISO(), currency: orig.currency, fxRate: 1, baseCurrency: 'USD',
      reference: orig.issuedNumber, poNumber: orig.poNumber, billToName: orig.billToName, billToEmail: orig.billToEmail, billToAddress: orig.billToAddress,
      retentionPct: orig.retentionPct, taxPct: orig.taxPct, attachments: [], createdAt: now(), createdBy: actor.name,
      creditForInvoiceId: invoiceId, creditType: writeOff ? 'write_off' : 'credit', creditReason: reason,
      description: `${writeOff ? 'Write-off' : 'Credit'} against ${orig.issuedNumber}`,
    });
    let built: ProjectInvoiceLineEntity[];
    if (writeOff) {
      const owed = await this.owedC(orig);
      const amountC = dto.amount == null || dto.amount === '' ? owed : toCents(dto.amount as any);
      if (amountC <= 0) throw new BadRequestException('Nothing is owed on this invoice to write off.');
      if (amountC > owed) throw new BadRequestException(`Only ${fmtUsd(owed)} is owed on ${orig.issuedNumber}.`);
      built = [this.lines.create({
        id: newId('PL'), invoiceId: cn.id, projectId: cn.projectId, kind: 'adjustment', lineOrder: 0, description: `Write-off: ${reason}`,
        amount: fromCents(-amountC), retentionApplies: false, retentionPct: 0, retentionAmount: 0, taxable: false, taxPct: 0, taxAmount: 0,
      } as unknown as ProjectInvoiceLineEntity)];
    } else {
      built = this.creditLines(cn, origLines, dto.lines || [], await this.creditRoom(invoiceId));
    }
    await this.invoices.manager.transaction(async (m) => {
      await m.getRepository(ProjectInvoiceEntity).save(cn);
      await m.getRepository(ProjectInvoiceLineEntity).save(built, { chunk: 40 });
    });
    await this.fin.log(null, { projectId: cn.projectId, entityType: 'invoice', entityId: cn.id, action: writeOff ? 'write_off_drafted' : 'credit_drafted', changes: { for: { from: null, to: orig.issuedNumber } }, reason }, actor);
    return this.get(cn.id, actor);
  }

  private creditLines(cn: ProjectInvoiceEntity, origLines: ProjectInvoiceLineEntity[], wanted: { lineId: string; amount: number | string }[], taken: Map<string, number>) {
    const picked = wanted.filter((w) => toCents(w.amount as any) !== 0);
    if (!picked.length) throw new BadRequestException('Choose at least one line and how much to credit on it.');
    return picked.map((w, i) => {
      const l = origLines.find((x) => x.id === w.lineId);
      if (!l) throw new BadRequestException('That line isn’t on the invoice being credited.');
      if (l.kind === 'adjustment' || l.kind === 'retention_release') throw new BadRequestException(`“${l.description}” can’t be credited line by line -- use a write-off or a new adjustment.`);
      const amountC = toCents(w.amount as any);
      const roomC = toCents(l.amount) - (taken.get(l.id) || 0);
      if (amountC <= 0) throw new BadRequestException('Credit amounts are entered as positive figures.');
      if (amountC > roomC) throw new BadRequestException(`Only ${fmtUsd(roomC)} of “${l.description}” is left to credit.`);
      const m = lineMath({ kind: l.kind, amountC: -amountC, retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct });
      return this.lines.create({
        id: newId('PL'), invoiceId: cn.id, projectId: cn.projectId, kind: l.kind, lineOrder: i, description: `Credit: ${l.description}`,
        targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId, billingMethod: l.billingMethod, contractValue: l.contractValue,
        amount: fromCents(-amountC), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, retentionAmount: fromCents(m.retentionC),
        taxable: l.taxable, taxPct: l.taxPct, taxAmount: fromCents(m.taxC), reimbursableId: l.reimbursableId, creditsLineId: l.id,
      } as unknown as ProjectInvoiceLineEntity);
    });
  }

  private async issueCredit(draft: ProjectInvoiceEntity, dto: { version?: number }, actor: Actor) {
    const issuedId = await this.invoices.manager.transaction(async (m) => {
      const number = await this.nextNumber(m, Number((draft.invoiceDate || todayISO()).slice(0, 4)), 'CN');
      const cn = await m.getRepository(ProjectInvoiceEntity).findOne({ where: { id: draft.id }, lock: { mode: 'pessimistic_write' } });
      if (!cn || cn.status !== 'draft') throw new BadRequestException('This credit note was issued or removed meanwhile.');
      assertVersion(cn, dto.version);
      const orig = await m.getRepository(ProjectInvoiceEntity).findOneBy({ id: cn.creditForInvoiceId });
      if (!orig || orig.status !== 'issued') throw new BadRequestException('The invoice being credited is no longer issued.');
      const lines = await m.getRepository(ProjectInvoiceLineEntity).find({ where: { invoiceId: cn.id } });
      const t = this.totalsOf(lines);
      if (t.totalC >= 0) throw new BadRequestException('A credit note has to reduce the invoice.');
      if (cn.creditType === 'write_off') {
        const owed = await this.owedC(orig, m);
        if (-t.totalC > owed) throw new BadRequestException(`Only ${fmtUsd(owed)} is still owed on ${orig.issuedNumber}.`);
      } else {
        // Another credit may have gone out since this one was drafted.
        const taken = await this.creditRoom(orig.id, m);
        const origLines = await m.getRepository(ProjectInvoiceLineEntity).find({ where: { invoiceId: orig.id } });
        for (const l of lines) {
          const o = origLines.find((x) => x.id === l.creditsLineId);
          if (!o) throw new BadRequestException('A credited line is no longer on the original invoice.');
          if (-toCents(l.amount) > toCents(o.amount) - (taken.get(o.id) || 0)) throw new BadRequestException(`“${o.description}” has been credited since -- only ${fmtUsd(toCents(o.amount) - (taken.get(o.id) || 0))} is left.`);
        }
      }
      Object.assign(cn, {
        status: 'issued', issuedNumber: number, issuedAt: now(), issuedById: actor.id, issuedByName: actor.name, updatedAt: now(), updatedBy: actor.name,
        contractWork: fromCents(t.contractWorkC), retentionAmount: fromCents(t.retentionC), adjustmentTotal: fromCents(t.adjustmentC), taxAmount: fromCents(t.taxC), total: fromCents(t.totalC),
      });
      await m.getRepository(ProjectInvoiceEntity).save(cn);
      await this.fin.log(m, { projectId: cn.projectId, entityType: 'invoice', entityId: cn.id, action: cn.creditType === 'write_off' ? 'write_off_issued' : 'credit_issued', changes: { number: { from: null, to: number }, total: { from: null, to: fromCents(t.totalC) } }, reason: cn.creditReason }, actor);
      await this.fin.approval(m, { projectId: cn.projectId, entityType: 'credit_note', entityId: cn.id, decision: 'issued', amount: fromCents(t.totalC), comment: cn.creditReason }, actor);
      return cn.id;
    });
    return this.get(issuedId, actor);
  }

  // ------------------------------------------------------------------ payments

  async recordPayment(invoiceId: string, dto: { date?: string; amount: number | string; method?: string; bankRef?: string; txnRef?: string; notes?: string }, actor: Actor) {
    await this.fin.need(actor, 'recordPayment');
    const inv = await this.load(invoiceId);
    if (inv.status !== 'issued' || inv.kind === 'credit') throw new BadRequestException('Payments go against an issued invoice.');
    const date = dto.date || todayISO();
    if (!ISO.test(date)) throw new BadRequestException('Give the payment date.');
    const amountC = toCents(dto.amount as any);
    if (amountC <= 0) throw new BadRequestException('The payment must be more than zero.');
    const method = dto.method || 'ach';
    if (!PAYMENT_METHODS.includes(method)) throw new BadRequestException('Unknown payment method.');
    const outstandingC = await this.owedC(inv);
    if (amountC > outstandingC) throw new BadRequestException(`Only ${fmtUsd(Math.max(outstandingC, 0))} is outstanding on ${inv.issuedNumber}.`);
    const p = await this.payments.save(this.payments.create({
      id: newId('PP'), invoiceId, projectId: inv.projectId, date, amount: fromCents(amountC), currency: inv.currency, fxRate: 1, method,
      bankRef: dto.bankRef?.trim() || undefined, txnRef: dto.txnRef?.trim() || undefined, notes: dto.notes?.trim() || undefined, attachments: [],
      createdAt: now(), createdBy: actor.name,
    }));
    await this.fin.log(null, { projectId: inv.projectId, entityType: 'payment', entityId: p.id, action: 'payment_recorded', changes: { amount: { from: null, to: p.amount }, invoice: { from: null, to: inv.issuedNumber } } }, actor);
    return this.get(invoiceId, actor);
  }

  async voidPayment(id: string, dto: { reason?: string; version?: number }, actor: Actor) {
    await this.fin.need(actor, 'recordPayment');
    const p = await this.payments.findOneBy({ id });
    if (!p) throw new NotFoundException('Payment not found');
    if (p.voidedAt) throw new BadRequestException('This payment is already void.');
    assertVersion(p, dto.version);
    if (!dto.reason?.trim()) throw new BadRequestException('Say why the payment is being voided.');
    Object.assign(p, { voidedAt: now(), voidedByName: actor.name, voidReason: dto.reason.trim(), updatedAt: now(), updatedBy: actor.name });
    await this.payments.save(p);
    await this.fin.log(null, { projectId: p.projectId, entityType: 'payment', entityId: id, action: 'payment_voided', changes: { amount: { from: p.amount, to: 0 } }, reason: dto.reason.trim() }, actor);
    return this.get(p.invoiceId, actor);
  }

  // ------------------------------------------------------------------ attachments (existing Drive plumbing)

  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const inv = await this.load(id);
    const added = await this.attachments!.upload(files, `Project ${inv.projectId}`, actor);
    inv.attachments = [...normalizeAttachments(inv.attachments), ...added];
    await this.invoices.save(inv);
    return normalizeAttachments(inv.attachments);
  }

  async addLink(id: string, name: string, url: string, actor: UploadActor) {
    const inv = await this.load(id);
    const att: TaskAttachment = { id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() };
    inv.attachments = [...normalizeAttachments(inv.attachments), att];
    await this.invoices.save(inv);
    return normalizeAttachments(inv.attachments);
  }

  async removeAttachment(id: string, attId: string) {
    const inv = await this.load(id);
    const all = normalizeAttachments(inv.attachments);
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('Attachment not found');
    await this.attachments!.discard(target);
    inv.attachments = all.filter((a) => a.id !== attId);
    await this.invoices.save(inv);
    return inv.attachments;
  }

  async attachment(id: string, attId: string) {
    const att = normalizeAttachments((await this.load(id)).attachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }
}
