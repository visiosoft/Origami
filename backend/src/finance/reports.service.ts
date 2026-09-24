import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CostEntryEntity, ProjectEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectPaymentEntity, RetentionReleaseEntity,
} from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { todayISO } from '../manpower/workforce.util';
import { computeSov, toDollars } from './finance.calc';
import { FinancialsService } from './financials.service';
import { ChangeOrdersService } from './change-orders.service';
import { CostsService } from './costs.service';
import { AGING_BUCKETS, agingBucket, profitability, type AgingBucket } from './costs.calc';
import { sumCents, toCents } from './money';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const monthOf = (d: string) => d.slice(0, 7);
const addMonths = (ym: string, n: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };

/**
 * Financial reports across projects: WIP (over/under billing), AR aging,
 * budget vs actual, change order register, retention, contract vs invoiced,
 * and a cash forecast. Every figure comes from the same calculations the
 * project screens use.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly fin: FinancialsService,
    private readonly costs: CostsService,
    private readonly cos: ChangeOrdersService,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectFinancialEntity) private readonly pfin: Repository<ProjectFinancialEntity>,
    @InjectRepository(ProjectInvoiceEntity) private readonly invoices: Repository<ProjectInvoiceEntity>,
    @InjectRepository(ProjectPaymentEntity) private readonly payments: Repository<ProjectPaymentEntity>,
    @InjectRepository(RetentionReleaseEntity) private readonly releases: Repository<RetentionReleaseEntity>,
    @InjectRepository(CostEntryEntity) private readonly entries: Repository<CostEntryEntity>,
  ) {}

  /** Projects with a client contract (and, with `withCosts`, projects that only have costs), optionally just one. */
  private async projectsIn(projectId?: number, withCosts = false) {
    const [settings, projects] = await Promise.all([this.pfin.find(), this.projects.find()]);
    const ids = new Set(settings.map((s) => s.projectId));
    if (withCosts) for (const id of await this.costs.projectsWithCosts()) ids.add(id);
    return projects.filter((p) => ids.has(p.id) && (!projectId || p.id === projectId)).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** WIP schedule: contract, forecast cost, cost to date, % complete (cost-to-cost), earned revenue, billed, over/(under) billing, margin. */
  async wip(actor: Actor) {
    await this.fin.need(actor, 'viewProfitability');
    const labor = await this.costs.laborAll();
    const rows = [];
    // A project with no cost budget or cost yet can't be put on a cost-to-cost basis; it's named, not shown as 100% margin.
    const withoutCosts: string[] = [];
    for (const p of await this.projectsIn()) {
      const [sov, cost] = await Promise.all([this.fin.context(p.id).then((c) => computeSov(c.input)), this.costs.context(p.id, labor)]);
      if (!cost.jc.totals.eacC && !cost.jc.totals.actualC) { withoutCosts.push(p.name); continue; }
      const reimbCostC = sumCents(cost.reimbs.filter((r) => r.status === 'approved' || r.status === 'billed').map((r) => toCents(r.cost)));
      const prof = profitability({
        contractC: sov.summary.revisedContractC, evC: sov.summary.evC, contractWorkInvoicedC: sov.summary.contractWorkInvoicedC,
        actualC: cost.jc.totals.actualC, eacC: cost.jc.totals.eacC, reimbursablesBilledC: sov.summary.reimbursablesBilledC, reimbursableCostC: reimbCostC,
      });
      rows.push({ projectId: p.id, name: p.name, stage: p.stage, ...toDollars({ ...prof, budgetC: cost.jc.totals.budgetC, committedC: cost.jc.totals.committedC }) });
    }
    return { asOf: todayISO(), rows, withoutCosts };
  }

  /** Money owed, by how late it is. */
  async arAging(actor: Actor, asOfIn?: string) {
    await this.fin.need(actor, 'view');
    const asOf = asOfIn && ISO.test(asOfIn) ? asOfIn : todayISO();
    const [invs, pays, projects] = await Promise.all([this.invoices.find({ where: { status: 'issued' } }), this.payments.find(), this.projects.find()]);
    const name = new Map(projects.map((p) => [p.id, p.name]));
    const credits = new Map<string, number>();
    for (const c of invs) if (c.kind === 'credit' && c.creditForInvoiceId) credits.set(c.creditForInvoiceId, (credits.get(c.creditForInvoiceId) || 0) + toCents(c.total));
    const paid = new Map<string, number>();
    for (const p of pays) if (!p.voidedAt && p.date <= asOf) paid.set(p.invoiceId, (paid.get(p.invoiceId) || 0) + toCents(p.amount));
    const rows = invs.filter((i) => i.kind !== 'credit' && i.invoiceDate <= asOf).map((i) => {
      const outstandingC = toCents(i.total) + (credits.get(i.id) || 0) - (paid.get(i.id) || 0);
      const { bucket, daysPastDue } = agingBucket(i.dueDate, asOf);
      return { invoiceId: i.id, number: i.issuedNumber, projectId: i.projectId, projectName: name.get(i.projectId) || `Project ${i.projectId}`, billTo: i.billToName, invoiceDate: i.invoiceDate, dueDate: i.dueDate, bucket, daysPastDue, totalC: toCents(i.total), outstandingC };
    }).filter((r) => r.outstandingC > 0).sort((a, b) => b.daysPastDue - a.daysPastDue);
    const totals = Object.fromEntries(AGING_BUCKETS.map((b) => [b, sumCents(rows.filter((r) => r.bucket === b).map((r) => r.outstandingC))])) as Record<AgingBucket, number>;
    const byProject = new Map<number, { projectId: number; name: string } & Record<AgingBucket | 'total', number>>();
    for (const r of rows) {
      const x = byProject.get(r.projectId) || { projectId: r.projectId, name: r.projectName, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
      x[r.bucket] += r.outstandingC; x.total += r.outstandingC;
      byProject.set(r.projectId, x);
    }
    const toD = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' && k !== 'projectId' && k !== 'daysPastDue' ? v / 100 : v]));
    return {
      asOf, buckets: AGING_BUCKETS, totals: toD({ ...totals, total: sumCents(rows.map((r) => r.outstandingC)) }),
      projects: Array.from(byProject.values()).map(toD), invoices: rows.map((r) => ({ ...r, total: r.totalC / 100, outstanding: r.outstandingC / 100, totalC: undefined, outstandingC: undefined })),
    };
  }

  /** Budget vs committed vs actual vs forecast -- one project by cost code, or every project's totals. */
  async budgetVsActual(actor: Actor, projectId?: number) {
    await this.fin.need(actor, 'viewProfitability');
    if (projectId) return { projectId, ...(await this.costs.overview(projectId, actor)) };
    const labor = await this.costs.laborAll();
    const rows = [];
    for (const p of await this.projectsIn(undefined, true)) {
      const c = await this.costs.context(p.id, labor);
      rows.push({ projectId: p.id, name: p.name, ...toDollars(c.jc.totals) });
    }
    return { rows };
  }

  /** Every change order with its dates, amounts and turnaround. */
  async changeOrderRegister(actor: Actor) {
    const all = await this.cos.all(actor);
    return all.map((c) => ({
      id: c.id, projectId: c.projectId, projectName: c.projectName, number: c.number, title: c.title, reason: c.reason, status: c.status,
      amount: c.total, cost: c.cost, margin: c.margin, scheduleImpactDays: c.scheduleImpactDays, dateRequested: c.dateRequested, submittedAt: c.submittedAt,
      approvedDate: c.clientApprovedDate || c.approvedAt, signer: c.clientSigner,
      daysToApprove: c.status === 'approved' && c.dateRequested && (c.clientApprovedDate || c.approvedAt)
        ? Math.max(0, Math.round((Date.parse((c.clientApprovedDate || c.approvedAt!).slice(0, 10)) - Date.parse(c.dateRequested)) / 86400000)) : null,
    }));
  }

  /** Retention accrued, released and still held per project, with releases in progress. */
  async retention(actor: Actor) {
    await this.fin.need(actor, 'view');
    const releases = await this.releases.find();
    const rows = [];
    for (const p of await this.projectsIn()) {
      const s = computeSov((await this.fin.context(p.id)).input).summary;
      const open = releases.filter((r) => r.projectId === p.id && (r.status === 'requested' || r.status === 'approved'));
      rows.push({ projectId: p.id, name: p.name, ...toDollars({ accruedC: s.retentionAccruedC, releasedC: s.retentionReleasedC, heldC: s.retentionHeldC, openC: sumCents(open.map((r) => toCents(r.amount))) }), openCount: open.length });
    }
    return { rows };
  }

  /** Contract (original, changes, revised) against earned, invoiced and collected. */
  async contractVsInvoiced(actor: Actor) {
    await this.fin.need(actor, 'view');
    const rows = [];
    for (const p of await this.projectsIn()) {
      const s = computeSov((await this.fin.context(p.id)).input).summary;
      rows.push({
        projectId: p.id, name: p.name, stage: p.stage,
        ...toDollars({
          originalC: s.originalContractC, changesC: s.approvedChangesC, pendingC: s.pendingChangesC, revisedC: s.revisedContractC, evC: s.evC,
          invoicedC: s.contractWorkInvoicedC, remainingC: s.remainingContractC, unbilledC: s.unbilledEarnedC, paidC: s.paidC, outstandingC: s.arOutstandingC,
        }),
        billedPct: s.revisedContractC ? Math.round((s.contractWorkInvoicedC / s.revisedContractC) * 1000) / 10 : 0,
      });
    }
    return { rows };
  }

  /**
   * Cash forecast by month: money coming in (open invoices by due date --
   * anything overdue lands in this month) and, for those who can see costs,
   * money going out (unpaid bills by due date). Payroll is paid through payroll
   * and isn't repeated here.
   */
  async cashForecast(actor: Actor, months = 6) {
    const r = await this.fin.need(actor, 'view');
    const n = Math.min(Math.max(Number(months) || 6, 1), 24);
    const start = monthOf(todayISO());
    const keys = Array.from({ length: n }, (_, i) => addMonths(start, i));
    const bucket = (d: string | null | undefined) => { const m = monthOf(d || todayISO()); return m < start ? start : keys.includes(m) ? m : null; };
    const aging = await this.arAging(actor);
    const inflow = new Map<string, number>(keys.map((k) => [k, 0]));
    for (const i of aging.invoices) { const k = bucket(i.dueDate); if (k) inflow.set(k, inflow.get(k)! + toCents(i.outstanding)); }
    const outflow = new Map<string, number>(keys.map((k) => [k, 0]));
    const showCosts = r.viewProfitability;
    if (showCosts) {
      for (const e of await this.entries.find()) {
        if (e.status !== 'recorded' && e.status !== 'approved') continue;
        const k = bucket(e.dueDate || e.date);
        if (k) outflow.set(k, outflow.get(k)! + toCents(e.amount));
      }
    }
    let running = 0;
    return {
      showCosts,
      months: keys.map((k) => {
        const net = inflow.get(k)! - outflow.get(k)!;
        running += net;
        return { month: k, ...toDollars({ inC: inflow.get(k)!, outC: outflow.get(k)!, netC: net, cumulativeC: running }) };
      }),
    };
  }
}
