import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeOrderEntity, FundingSourceEntity, ProjectInvoiceEntity, ProjectPaymentEntity } from '../database/entities';
import { newId } from '../manpower/workforce.util';
import type { Actor } from '../manpower/manpower-access.service';
import { computeSov } from './finance.calc';
import { FinancialsService } from './financials.service';
import { FUNDING_KINDS, fundingSummary, isFundingKind } from './funding';
import { fromCents, toCents } from './money';

const now = () => new Date().toISOString();
const LABEL: Record<string, string> = { loan: 'Loan', owner_cash: 'Owner cash', other: 'Other' };

/**
 * Funding sources on a project (Batch 6): what each one approved, what's been
 * invoiced to and paid from it, and the gap against the contract. Owner
 * invoices and change orders are tagged with the source that pays them.
 */
@Injectable()
export class FundingService {
  constructor(
    @InjectRepository(FundingSourceEntity) private readonly sources: Repository<FundingSourceEntity>,
    @InjectRepository(ProjectInvoiceEntity) private readonly invoices: Repository<ProjectInvoiceEntity>,
    @InjectRepository(ProjectPaymentEntity) private readonly payments: Repository<ProjectPaymentEntity>,
    @InjectRepository(ChangeOrderEntity) private readonly changeOrders: Repository<ChangeOrderEntity>,
    private readonly fin: FinancialsService,
  ) {}

  async view(projectId: number, actor: Actor) {
    const rights = await this.fin.need(actor, 'view');
    await this.fin.project(projectId);
    const [srcs, invs, pays, cos, ctx] = await Promise.all([
      this.sources.find({ where: { projectId } }),
      this.invoices.find({ where: { projectId } }),
      this.payments.find({ where: { projectId } }),
      this.changeOrders.find({ where: { projectId } }),
      this.fin.context(projectId),
    ]);
    srcs.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
    const issued = invs.filter((i) => i.status === 'issued');
    const byId = new Map(invs.map((i) => [i.id, i]));
    // A credit note counts against the source of the invoice it credits, unless it's tagged itself.
    const sourceOf = (i: ProjectInvoiceEntity) => i.fundingSourceId || (i.creditForInvoiceId ? byId.get(i.creditForInvoiceId)?.fundingSourceId || null : null);
    const paidC = new Map<string, number>();
    for (const p of pays) if (!p.voidedAt) paidC.set(p.invoiceId, (paidC.get(p.invoiceId) || 0) + toCents(p.amount));
    const totalC = (i: ProjectInvoiceEntity) => { const t = toCents(i.total || 0); return i.kind === 'credit' ? -Math.abs(t) : t; };
    const approvedCos = cos.filter((c) => c.status === 'approved');
    const sum = fundingSummary(
      srcs.map((s) => ({ id: s.id, kind: s.kind, name: s.name, approvedC: toCents(s.approvedAmount) })),
      issued.map((i) => ({ id: i.id, fundingSourceId: sourceOf(i), totalC: totalC(i), paidC: paidC.get(i.id) || 0 })),
      approvedCos.map((c) => ({ id: c.id, fundingSourceId: c.fundingSourceId, amountC: toCents(c.amount || 0) })),
      computeSov(ctx.input).summary.revisedContractC,
    );
    const d = (c: number) => fromCents(c);
    return {
      canManage: !!rights.manage,
      kinds: FUNDING_KINDS.map((k) => ({ key: k, label: LABEL[k] })),
      sources: sum.sources.map((s) => {
        const row = srcs.find((x) => x.id === s.id)!;
        return { id: s.id, kind: s.kind, kindLabel: LABEL[s.kind] || s.kind, name: s.name, notes: row.notes, approved: d(s.approvedC), invoiced: d(s.invoicedC), paid: d(s.paidC), left: d(s.leftC), changeOrders: d(s.changesC), over: s.over };
      }),
      approved: d(sum.approvedC), revisedContract: d(sum.revisedContractC), gap: d(sum.gapC),
      unassignedInvoiced: d(sum.unassignedInvoicedC), unassignedCount: sum.unassignedCount,
      // What can be tagged with a source.
      invoices: issued.filter((i) => i.kind !== 'credit').map((i) => ({ id: i.id, number: i.issuedNumber, date: i.invoiceDate, total: i.total, fundingSourceId: i.fundingSourceId })),
      changeOrders: approvedCos.map((c) => ({ id: c.id, number: c.number, title: c.title, amount: c.amount, fundingSourceId: c.fundingSourceId })),
    };
  }

  /** Add or edit a funding source. */
  async save(projectId: number, dto: { id?: string; kind?: string; name?: string; approvedAmount?: number | string; notes?: string }, actor: Actor) {
    await this.fin.need(actor, 'manage');
    await this.fin.project(projectId);
    const name = String(dto.name || '').trim().slice(0, 200);
    if (!name) throw new BadRequestException('Name the funding source, e.g. “Bank of the West construction loan”.');
    if (!isFundingKind(dto.kind)) throw new BadRequestException('Pick loan, owner cash or other.');
    const amt = Number(dto.approvedAmount);
    if (!Number.isFinite(amt) || amt < 0) throw new BadRequestException('Enter the amount approved.');
    const row = dto.id ? await this.sources.findOneBy({ id: dto.id }) : null;
    if (dto.id && (!row || row.projectId !== projectId)) throw new NotFoundException('Funding source not found.');
    const count = row ? 0 : await this.sources.count({ where: { projectId } });
    const saved = await this.sources.save({
      ...(row || { id: newId('FS'), projectId, createdAt: now(), createdBy: actor.name, sortOrder: count }),
      kind: dto.kind, name, approvedAmount: fromCents(toCents(amt)), notes: String(dto.notes || '').trim() || null, updatedAt: row ? now() : null,
    } as FundingSourceEntity);
    await this.fin.log(null, { projectId, entityType: 'project', entityId: String(projectId), action: row ? 'funding_source_updated' : 'funding_source_added', changes: { [name]: { from: row ? row.approvedAmount : null, to: saved.approvedAmount } } }, actor);
    return this.view(projectId, actor);
  }

  /** Remove a source; anything tagged with it goes back to unassigned. */
  async remove(id: string, actor: Actor) {
    await this.fin.need(actor, 'manage');
    const row = await this.sources.findOneBy({ id });
    if (!row) throw new NotFoundException('Funding source not found.');
    await this.invoices.update({ fundingSourceId: id }, { fundingSourceId: null });
    await this.changeOrders.update({ fundingSourceId: id }, { fundingSourceId: null });
    await this.sources.delete({ id });
    await this.fin.log(null, { projectId: row.projectId, entityType: 'project', entityId: String(row.projectId), action: 'funding_source_removed', changes: { [row.name]: { from: row.approvedAmount, to: null } } }, actor);
    return this.view(row.projectId, actor);
  }

  /** "Paid from": tag an owner invoice or change order with a source (or clear it). */
  async assign(projectId: number, dto: { invoiceId?: string; changeOrderId?: string; fundingSourceId?: string | null }, actor: Actor) {
    await this.fin.need(actor, 'manage');
    const fs = dto.fundingSourceId ? await this.sources.findOneBy({ id: dto.fundingSourceId }) : null;
    if (dto.fundingSourceId && (!fs || fs.projectId !== projectId)) throw new NotFoundException('Funding source not found.');
    const to = fs ? fs.id : null;
    if (dto.invoiceId) {
      const inv = await this.invoices.findOneBy({ id: dto.invoiceId });
      if (!inv || inv.projectId !== projectId) throw new NotFoundException('Invoice not found.');
      // A plain column update: tagging doesn't change the invoice, so it doesn't bump its version.
      await this.invoices.update({ id: inv.id }, { fundingSourceId: to });
    } else if (dto.changeOrderId) {
      const co = await this.changeOrders.findOneBy({ id: dto.changeOrderId });
      if (!co || co.projectId !== projectId) throw new NotFoundException('Change order not found.');
      await this.changeOrders.update({ id: co.id }, { fundingSourceId: to });
    } else throw new BadRequestException('Pick an invoice or change order.');
    return this.view(projectId, actor);
  }
}
