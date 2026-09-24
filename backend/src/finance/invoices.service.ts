import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  FinanceSequenceEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity,
} from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { normalizeAttachments, subId, type TaskAttachment } from '../database/task.types';
import { newId, todayISO } from '../manpower/workforce.util';
import { computeSov, invoiceTotals, lineMath, toDollars, type SovRow } from './finance.calc';
import { assertVersion, FinancialsService } from './financials.service';
import { fromCents, pctOf, roundPct, sumCents, toCents } from './money';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const LINE_KINDS = ['progress', 'manual', 'adjustment'];
export const PAYMENT_METHODS = ['ach', 'check', 'wire', 'card', 'cash', 'other'];
const now = () => new Date().toISOString();
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const fmtUsd = (c: number) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface LineDto {
  id?: string; kind: string; targetType?: string | null; phaseId?: string | null; taskId?: string | null; description?: string;
  amount?: number | string | null; currentProgressPct?: number | string | null; quantity?: number | string | null; unit?: string | null; rate?: number | string | null;
  retentionApplies?: boolean; taxable?: boolean;
}

/** The billable items of a project's SOV, flattened: lump sum, milestones billed as a whole, tasks and unphased tasks. */
function billableItems(sov: ReturnType<typeof computeSov>) {
  const out: SovRow[] = [];
  if (sov.lump) out.push(sov.lump);
  for (const g of sov.groups) for (const r of g.rows) {
    if (r.kind === 'phase') { if (r.valueFromTasks) out.push(...(r.children || []).filter((c) => c.ownValueC != null)); else if (r.ownValueC != null) out.push(r); }
    else out.push(r);
  }
  return out;
}
const itemKey = (x: { targetType?: string | null; kind?: string; phaseId?: string | null; taskId?: string | null; id?: string }) =>
  x.targetType === 'project' || x.kind === 'project' ? 'project' : x.taskId ? `task:${x.taskId}` : x.phaseId ? `phase:${x.phaseId}` : (x.kind === 'task' ? `task:${x.id}` : `phase:${x.id}`);

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(ProjectInvoiceEntity) private readonly invoices: Repository<ProjectInvoiceEntity>,
    @InjectRepository(ProjectInvoiceLineEntity) private readonly lines: Repository<ProjectInvoiceLineEntity>,
    @InjectRepository(ProjectPaymentEntity) private readonly payments: Repository<ProjectPaymentEntity>,
    @InjectRepository(ProjectFinancialEntity) private readonly pfin: Repository<ProjectFinancialEntity>,
    private readonly fin: FinancialsService,
    private readonly attachments?: AttachmentsService,
  ) {}

  // ------------------------------------------------------------------ reading

  private async load(id: string) {
    const inv = await this.invoices.findOneBy({ id });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  /** Totals (live for drafts, the issue snapshot otherwise), paid, outstanding and payment status. */
  private present(inv: ProjectInvoiceEntity, lines: ProjectInvoiceLineEntity[], pays: ProjectPaymentEntity[]) {
    const live = invoiceTotals(lines.map((l) => ({ kind: l.kind, amountC: toCents(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })));
    const t = inv.status === 'draft' ? live : {
      contractWorkC: toCents(inv.contractWork), retentionC: toCents(inv.retentionAmount), adjustmentC: toCents(inv.adjustmentTotal), taxC: toCents(inv.taxAmount), totalC: toCents(inv.total),
    };
    const paidC = inv.status === 'issued' ? sumCents(pays.filter((p) => !p.voidedAt).map((p) => toCents(p.amount))) : 0;
    const outstandingC = inv.status === 'issued' ? t.totalC - paidC : 0;
    const overdue = inv.status === 'issued' && outstandingC > 0 && !!inv.dueDate && inv.dueDate < todayISO();
    const paymentStatus = inv.status === 'draft' ? 'draft' : inv.status === 'void' ? 'void' : outstandingC <= 0 ? 'paid' : overdue ? 'overdue' : paidC > 0 ? 'partially_paid' : 'unpaid';
    return { ...inv, ...toDollars({ ...t, paidC, outstandingC }), paymentStatus, overdue, attachments: normalizeAttachments(inv.attachments) };
  }

  async list(projectId: number, actor: Actor) {
    await this.need(actor, 'view');
    const [invs, lines, pays] = await Promise.all([
      this.invoices.find({ where: { projectId } }), this.lines.find({ where: { projectId } }), this.payments.find({ where: { projectId } }),
    ]);
    return invs.map((inv) => this.present(inv, lines.filter((l) => l.invoiceId === inv.id), pays.filter((p) => p.invoiceId === inv.id)))
      .sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async get(id: string, actor: Actor) {
    await this.need(actor, 'view');
    const inv = await this.load(id);
    const [lines, pays] = await Promise.all([this.lines.find({ where: { invoiceId: id } }), this.payments.find({ where: { invoiceId: id } })]);
    const sorted = lines.sort((a, b) => a.lineOrder - b.lineOrder);
    return {
      ...this.present(inv, sorted, pays),
      lines: sorted.map((l) => ({ ...l, ...toDollars(lineMath({ kind: l.kind, amountC: toCents(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })) })),
      payments: pays.sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async projectPayments(projectId: number, actor: Actor) {
    await this.need(actor, 'view');
    const [pays, invs] = await Promise.all([this.payments.find({ where: { projectId } }), this.invoices.find({ where: { projectId } })]);
    const num = new Map(invs.map((i) => [i.id, i.issuedNumber]));
    return pays.map((p) => ({ ...p, invoiceNumber: num.get(p.invoiceId) })).sort((a, b) => b.date.localeCompare(a.date));
  }

  private async need(actor: Actor, what: 'view' | 'manage') {
    const r = await this.fin.rights(actor);
    if (!r[what]) throw new ForbiddenException(what === 'view' ? "Your role doesn't include project financials." : "Your role doesn't allow invoicing or payments.");
  }

  // ------------------------------------------------------------------ drafts

  /** A draft from selected items (or every item ready to bill), each claiming what it has earned but not yet billed. */
  async createDraft(projectId: number, dto: { items?: { kind: string; id: string }[]; billReady?: boolean; kind?: string; description?: string }, actor: Actor) {
    await this.need(actor, 'manage');
    const { row: s } = await this.fin.settingsFor(projectId);
    if (!s) throw new BadRequestException('Set up this project’s financials (contract value, retention, tax) before invoicing.');
    const ctx = await this.fin.context(projectId);
    const sov = computeSov(ctx.input);
    const items = billableItems(sov);
    // Only items with something earned and not yet billed get a line; a standard invoice may start empty for manual lines.
    const standard = dto.kind === 'standard';
    const wanted = standard ? [] : (dto.billReady || !dto.items?.length
      ? items
      : items.filter((r) => dto.items!.some((x) => itemKey({ kind: x.kind, id: x.id }) === itemKey({ kind: r.kind, id: r.id })))).filter((r) => r.billableC > 0);
    if (!standard && !wanted.length) throw new BadRequestException('Nothing is ready to invoice: no item has earned more than has been billed. Update progress first, or start a standard invoice for manual items.');
    const today = todayISO();
    const inv = this.invoices.create({
      id: newId('PI'), projectId, kind: dto.kind === 'standard' ? 'standard' : 'progress', status: 'draft', invoiceDate: today,
      dueDate: addDays(today, s.paymentTermsDays ?? 30), currency: s.currency || 'USD', fxRate: 1, baseCurrency: 'USD',
      reference: s.contractNumber, poNumber: s.poNumber, description: dto.description, billToName: s.billToName, billToEmail: s.billToEmail, billToAddress: s.billToAddress,
      retentionPct: s.retentionPct, taxPct: s.taxPct, attachments: [], createdAt: now(), createdBy: actor.name,
    });
    const lineDtos: LineDto[] = wanted.map((r) => ({
      kind: 'progress', targetType: r.kind, phaseId: r.kind === 'phase' ? r.id : r.kind === 'task' ? r.phaseId : null, taskId: r.kind === 'task' ? r.id : null,
      description: r.name, amount: fromCents(r.billableC),
    }));
    const built = this.buildLines(inv, lineDtos, sov);
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
  private buildLines(inv: ProjectInvoiceEntity, dtos: LineDto[], sov: ReturnType<typeof computeSov>): ProjectInvoiceLineEntity[] {
    const items = new Map(billableItems(sov).map((r) => [itemKey({ kind: r.kind, id: r.id }), r]));
    const claimed = new Map<string, number>();
    return dtos.map((d, i) => {
      if (!LINE_KINDS.includes(d.kind)) throw new BadRequestException('A line is progress, manual or an adjustment.');
      const base: Partial<ProjectInvoiceLineEntity> = {
        id: d.id && d.id.startsWith('PL') ? d.id : newId('PL'), invoiceId: inv.id, projectId: inv.projectId, kind: d.kind, lineOrder: i,
        description: String(d.description || '').trim(), unit: d.unit || undefined,
      };
      let amountC: number;
      let retPct = Number(inv.retentionPct) || 0;
      let taxPct = Number(inv.taxPct) || 0;
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
      } else {
        amountC = toCents(d.amount as any);
        if (!base.description) throw new BadRequestException(`Line ${i + 1}: say what the adjustment is for.`);
        if (!amountC) throw new BadRequestException(`Line ${i + 1}: an adjustment needs an amount (negative for a discount).`);
        retPct = 0;
      }
      const retentionApplies = d.kind === 'adjustment' ? false : d.retentionApplies ?? true;
      const taxable = d.taxable ?? (d.kind !== 'adjustment' && taxPct > 0);
      const m = lineMath({ kind: d.kind, amountC, retentionApplies, retentionPct: retPct, taxable, taxPct });
      return this.lines.create({
        ...base, amount: fromCents(amountC), retentionApplies, retentionPct: retentionApplies ? retPct : 0,
        retentionAmount: fromCents(m.retentionC), taxable, taxPct: taxable ? taxPct : 0, taxAmount: fromCents(m.taxC),
      } as ProjectInvoiceLineEntity);
    });
  }

  async updateDraft(id: string, dto: any, actor: Actor) {
    await this.need(actor, 'manage');
    const inv = await this.load(id);
    if (inv.status !== 'draft') throw new BadRequestException('Only a draft can be edited. Issued invoices are permanent -- void and reissue to correct one.');
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
    for (const k of ['retentionPct', 'taxPct'] as const) {
      if (dto[k] !== undefined) {
        const n = Number(dto[k]);
        if (!Number.isFinite(n) || n < 0 || n > 100) throw new BadRequestException(`${k === 'taxPct' ? 'Tax' : 'Retention'} must be between 0 and 100.`);
        inv[k] = roundPct(n);
      }
    }
    Object.assign(inv, { updatedAt: now(), updatedBy: actor.name });
    const old = await this.lines.find({ where: { invoiceId: id } });
    const next = dto.lines ? this.buildLines(inv, dto.lines, computeSov((await this.fin.context(inv.projectId)).input))
      : this.buildLines(inv, old.sort((a, b) => a.lineOrder - b.lineOrder).map((l) => ({ ...l, amount: l.amount })), computeSov((await this.fin.context(inv.projectId)).input));
    await this.invoices.manager.transaction(async (m) => {
      await m.getRepository(ProjectInvoiceEntity).save(inv);
      const gone = old.filter((o) => !next.some((n) => n.id === o.id));
      if (gone.length) await m.getRepository(ProjectInvoiceLineEntity).remove(gone);
      if (next.length) await m.getRepository(ProjectInvoiceLineEntity).save(next, { chunk: 40 });
    });
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ['invoiceDate', 'dueDate', 'retentionPct', 'taxPct', 'billToName', 'poNumber'] as const) if (String(before[k] ?? '') !== String(inv[k] ?? '')) changes[k] = { from: before[k] ?? null, to: inv[k] ?? null };
    if (dto.lines) changes.lines = { from: old.length, to: next.length };
    await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_draft_changed', changes }, actor);
    return this.get(id, actor);
  }

  async removeDraft(id: string, actor: Actor) {
    await this.need(actor, 'manage');
    const inv = await this.load(id);
    if (inv.status !== 'draft') throw new BadRequestException('Issued invoices are never deleted -- void it instead.');
    await this.invoices.manager.transaction(async (m) => {
      await m.getRepository(ProjectInvoiceLineEntity).delete({ invoiceId: id });
      await m.getRepository(ProjectInvoiceEntity).remove(inv);
    });
    await this.attachments?.discardAll(normalizeAttachments(inv.attachments));
    await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_draft_deleted' }, actor);
    return { id, deleted: true };
  }

  // ------------------------------------------------------------------ issuing

  /** The next invoice number, taken under an update lock so two issues can never share one. */
  async nextNumber(m: EntityManager, year: number) {
    const repo = m.getRepository(FinanceSequenceEntity);
    const id = `INV-${year}`;
    let seq = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!seq) {
      try { await repo.insert({ id, next: 1 }); } catch { /* someone created it first */ }
      seq = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    }
    const n = seq!.next;
    await repo.update({ id }, { next: n + 1 });
    return `INV-${year}-${String(n).padStart(4, '0')}`;
  }

  /**
   * Make a draft a permanent invoice. Inside one transaction, and after taking
   * the numbering lock (which serialises issues), every line is re-checked
   * against what is billed now, snapshotted, and the totals frozen.
   */
  async issue(id: string, dto: { version?: number }, actor: Actor) {
    await this.need(actor, 'manage');
    const draft = await this.load(id);
    if (draft.status !== 'draft') throw new BadRequestException(`This invoice is already ${draft.status}.`);
    assertVersion(draft, dto.version);
    const issuedId = await this.invoices.manager.transaction(async (m) => {
      const number = await this.nextNumber(m, Number((draft.invoiceDate || todayISO()).slice(0, 4)));
      const inv = await m.getRepository(ProjectInvoiceEntity).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!inv || inv.status !== 'draft') throw new BadRequestException('This invoice was issued or removed meanwhile.');
      assertVersion(inv, dto.version);
      const old = await m.getRepository(ProjectInvoiceLineEntity).find({ where: { invoiceId: id } });
      if (!old.length) throw new BadRequestException('Add at least one line before issuing.');
      // Re-price against what has been issued up to this moment (another invoice may have gone out since the draft).
      const sov = computeSov((await this.fin.context(inv.projectId)).input);
      const lines = this.buildLines(inv, old.sort((a, b) => a.lineOrder - b.lineOrder).map((l) => ({
        id: l.id, kind: l.kind, targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId, description: l.description,
        amount: l.amount, quantity: l.quantity, unit: l.unit, rate: l.rate, retentionApplies: l.retentionApplies, taxable: l.taxable,
      })), sov);
      const t = invoiceTotals(lines.map((l) => ({ kind: l.kind, amountC: toCents(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct })));
      // Contract work (pre-tax) may never exceed the contract.
      if (sov.summary.contractWorkInvoicedC + t.contractWorkC > sov.summary.revisedContractC) {
        throw new BadRequestException(`This would bring contract work invoiced to ${fmtUsd(sov.summary.contractWorkInvoicedC + t.contractWorkC)} on a ${fmtUsd(sov.summary.revisedContractC)} contract. Only ${fmtUsd(Math.max(sov.summary.revisedContractC - sov.summary.contractWorkInvoicedC, 0))} is left.`);
      }
      if (t.totalC < 0) throw new BadRequestException('The invoice total can’t be negative.');
      Object.assign(inv, {
        status: 'issued', issuedNumber: number, issuedAt: now(), issuedById: actor.id, issuedByName: actor.name, updatedAt: now(), updatedBy: actor.name,
        contractWork: fromCents(t.contractWorkC), retentionAmount: fromCents(t.retentionC), adjustmentTotal: fromCents(t.adjustmentC), taxAmount: fromCents(t.taxC), total: fromCents(t.totalC),
      });
      await m.getRepository(ProjectInvoiceLineEntity).save(lines, { chunk: 40 });
      await m.getRepository(ProjectInvoiceEntity).save(inv);
      const s = await m.getRepository(ProjectFinancialEntity).findOneBy({ projectId: inv.projectId });
      if (s && !s.contractLockedAt) { s.contractLockedAt = now(); s.updatedAt = now(); s.updatedBy = actor.name; await m.getRepository(ProjectFinancialEntity).save(s); }
      await this.fin.log(m, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_issued', changes: { number: { from: null, to: number }, total: { from: null, to: fromCents(t.totalC) } } }, actor);
      return inv.id;
    });
    return this.get(issuedId, actor);
  }

  /** Cancel an issued invoice that has nothing paid against it; it stops counting everywhere but stays on record. */
  async void(id: string, dto: { reason?: string; version?: number }, actor: Actor) {
    await this.need(actor, 'manage');
    const inv = await this.load(id);
    if (inv.status !== 'issued') throw new BadRequestException(inv.status === 'draft' ? 'Delete a draft instead of voiding it.' : 'This invoice is already void.');
    assertVersion(inv, dto.version);
    if (!dto.reason?.trim()) throw new BadRequestException('Say why the invoice is being voided.');
    const live = (await this.payments.find({ where: { invoiceId: id } })).filter((p) => !p.voidedAt);
    if (live.length) throw new BadRequestException(`${live.length} payment(s) are recorded against this invoice -- void them first.`);
    Object.assign(inv, { status: 'void', voidedAt: now(), voidedById: actor.id, voidedByName: actor.name, voidReason: dto.reason.trim(), updatedAt: now(), updatedBy: actor.name });
    await this.invoices.save(inv);
    await this.fin.log(null, { projectId: inv.projectId, entityType: 'invoice', entityId: id, action: 'invoice_voided', changes: { status: { from: 'issued', to: 'void' } }, reason: dto.reason.trim() }, actor);
    return this.get(id, actor);
  }

  // ------------------------------------------------------------------ payments

  async recordPayment(invoiceId: string, dto: { date?: string; amount: number | string; method?: string; bankRef?: string; txnRef?: string; notes?: string }, actor: Actor) {
    await this.need(actor, 'manage');
    const inv = await this.load(invoiceId);
    if (inv.status !== 'issued') throw new BadRequestException('Payments go against an issued invoice.');
    const date = dto.date || todayISO();
    if (!ISO.test(date)) throw new BadRequestException('Give the payment date.');
    const amountC = toCents(dto.amount as any);
    if (amountC <= 0) throw new BadRequestException('The payment must be more than zero.');
    const method = dto.method || 'ach';
    if (!PAYMENT_METHODS.includes(method)) throw new BadRequestException('Unknown payment method.');
    const paidC = sumCents((await this.payments.find({ where: { invoiceId } })).filter((p) => !p.voidedAt).map((p) => toCents(p.amount)));
    const outstandingC = toCents(inv.total) - paidC;
    if (amountC > outstandingC) throw new BadRequestException(`Only ${fmtUsd(outstandingC)} is outstanding on ${inv.issuedNumber}.`);
    const p = await this.payments.save(this.payments.create({
      id: newId('PP'), invoiceId, projectId: inv.projectId, date, amount: fromCents(amountC), currency: inv.currency, fxRate: 1, method,
      bankRef: dto.bankRef?.trim() || undefined, txnRef: dto.txnRef?.trim() || undefined, notes: dto.notes?.trim() || undefined, attachments: [],
      createdAt: now(), createdBy: actor.name,
    }));
    await this.fin.log(null, { projectId: inv.projectId, entityType: 'payment', entityId: p.id, action: 'payment_recorded', changes: { amount: { from: null, to: p.amount }, invoice: { from: null, to: inv.issuedNumber } } }, actor);
    return this.get(invoiceId, actor);
  }

  async voidPayment(id: string, dto: { reason?: string; version?: number }, actor: Actor) {
    await this.need(actor, 'manage');
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
