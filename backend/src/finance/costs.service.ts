import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ChangeOrderEntity, ChangeOrderItemEntity, CommitmentEntity, CommitmentLineEntity, ContractorEntity, CostBudgetLineEntity, CostEntryEntity,
  CostForecastEntity, CsiCodeEntity, DailyLogEntity, EmployeeEntity, LaborLogEntryEntity, ReimbursableEntity, TimesheetEntity, TimesheetLineEntity,
} from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { normalizeAttachments, subId, type TaskAttachment } from '../database/task.types';
import { newId, todayISO } from '../manpower/workforce.util';
import { SettingsService } from '../settings/settings.service';
import { DEFAULT_PAYROLL_SETTINGS } from '../manpower/payroll.calc';
import { computeSov, toDollars } from './finance.calc';
import { assertVersion, FinancialsService } from './financials.service';
import { burdened, computeJobCost, laborLines, NO_CODE, profitability, type LaborFact, type LaborLine, type LaborSettings } from './costs.calc';
import { fromCents, sumCents, toCents } from './money';
import { PortalService } from './portal.service';

export const COMMITMENT_TYPES = ['subcontract', 'purchase_order', 'service'];
export const COST_TYPES = ['vendor_bill', 'subcontract_invoice', 'material', 'equipment', 'other'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const now = () => new Date().toISOString();
const fmtUsd = (c: number) => (c < 0 ? '-$' : '$') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

const money = (v: unknown, what: string, allowZero = false) => {
  const c = toCents(v as any);
  if (!Number.isFinite(c) || (allowZero ? c < 0 : c <= 0)) throw new BadRequestException(`${what} must be ${allowZero ? 'zero or more' : 'more than zero'}.`);
  return fromCents(c);
};

/**
 * Job cost: the budget by cost code, subcontracts and purchase orders
 * committed against it, what's been spent (bills, labor from approved
 * timesheets and daily logs, reimbursable expenses), and the forecast at
 * completion -- with the project's margin now and at the end.
 */
@Injectable()
export class CostsService {
  constructor(
    private readonly fin: FinancialsService,
    private readonly settings: SettingsService,
    @InjectRepository(CostBudgetLineEntity) private readonly budget: Repository<CostBudgetLineEntity>,
    @InjectRepository(CommitmentEntity) private readonly commitments: Repository<CommitmentEntity>,
    @InjectRepository(CommitmentLineEntity) private readonly commitmentLines: Repository<CommitmentLineEntity>,
    @InjectRepository(CostEntryEntity) private readonly entries: Repository<CostEntryEntity>,
    @InjectRepository(CostForecastEntity) private readonly forecasts: Repository<CostForecastEntity>,
    @InjectRepository(ChangeOrderEntity) private readonly cos: Repository<ChangeOrderEntity>,
    @InjectRepository(ChangeOrderItemEntity) private readonly coItems: Repository<ChangeOrderItemEntity>,
    @InjectRepository(ReimbursableEntity) private readonly reimbs: Repository<ReimbursableEntity>,
    @InjectRepository(TimesheetEntity) private readonly timesheets: Repository<TimesheetEntity>,
    @InjectRepository(TimesheetLineEntity) private readonly timesheetLines: Repository<TimesheetLineEntity>,
    @InjectRepository(DailyLogEntity) private readonly dailyLogs: Repository<DailyLogEntity>,
    @InjectRepository(LaborLogEntryEntity) private readonly laborEntries: Repository<LaborLogEntryEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(CsiCodeEntity) private readonly codes: Repository<CsiCodeEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    private readonly attachments?: AttachmentsService,
    private readonly portal?: PortalService,
  ) {}

  private async canSee(actor: Actor) {
    const r = await this.fin.rights(actor);
    if (!r.viewProfitability && !r.manageCosts) await this.fin.need(actor, 'viewProfitability');
    return r;
  }

  // ------------------------------------------------------------------ labor

  private async laborSettings(): Promise<LaborSettings> {
    let saved: any = {};
    try { saved = JSON.parse((await this.settings.get('payroll.settings')) || '{}'); } catch { saved = {}; }
    const s = { ...DEFAULT_PAYROLL_SETTINGS, ...saved, otMultipliers: { ...DEFAULT_PAYROLL_SETTINGS.otMultipliers, ...(saved.otMultipliers || {}) } };
    return { standardDayHours: Number(s.standardDayHours) || 8, monthDays: Number(s.monthDays) || 21.67, otMultiplier: Number(s.otMultipliers.normal) || 1.5 };
  }

  /**
   * Labor on every project from approved timesheets and approved daily labor
   * logs. Overtime is decided per person per day across projects, so all
   * projects are read together; callers pick out the project they want.
   */
  async laborAll(): Promise<LaborLine[]> {
    const [sheets, logs, people, s] = await Promise.all([
      this.timesheets.find({ where: { status: 'approved' } }), this.dailyLogs.find({ where: { status: 'approved' } }), this.employees.find(), this.laborSettings(),
    ]);
    const [tsLines, logEntries] = await Promise.all([
      sheets.length ? this.timesheetLines.find({ where: { timesheetId: In(sheets.map((x) => x.id)), kind: 'project' } }) : Promise.resolve([]),
      logs.length ? this.laborEntries.find({ where: { dailyLogId: In(logs.map((x) => x.id)) } }) : Promise.resolve([]),
    ]);
    const facts: LaborFact[] = [];
    for (const l of tsLines) {
      if (!l.projectId) continue;
      for (const [date, d] of Object.entries(l.days || {})) facts.push({ employeeId: l.employeeId, projectId: l.projectId, date, csiCodeId: l.csiCodeId || null, hours: Number(d?.hours) || 0, source: 'timesheet' });
    }
    const logById = new Map(logs.map((x) => [x.id, x]));
    for (const e of logEntries) {
      const log = logById.get(e.dailyLogId);
      if (log) facts.push({ employeeId: e.employeeId, projectId: log.projectId, date: log.date, csiCodeId: e.csiCodeId || null, hours: Number(e.hours) || 0, source: 'daily_log' });
    }
    return laborLines(facts, new Map(people.map((p) => [p.id, { id: p.id, name: p.name, payType: p.payType, payRate: p.payRate, overtimeRate: p.overtimeRate }])), s);
  }

  // ------------------------------------------------------------------ the picture

  /** Everything the job-cost figures for one project are computed from. */
  async context(projectId: number, labor?: LaborLine[]) {
    const [budget, commitments, lines, entries, forecasts, cos, reimbs, s] = await Promise.all([
      this.budget.find({ where: { projectId } }), this.commitments.find({ where: { projectId } }), this.commitmentLines.find({ where: { projectId } }),
      this.entries.find({ where: { projectId } }), this.forecasts.find({ where: { projectId } }), this.cos.find({ where: { projectId, status: 'approved' } }),
      this.reimbs.find({ where: { projectId } }), this.fin.settingsFor(projectId),
    ]);
    const coItems = cos.length ? await this.coItems.find({ where: { changeOrderId: In(cos.map((c) => c.id)) } }) : [];
    const burden = Number(s.value.laborBurdenPct) || 0;
    const myLabor = (labor || await this.laborAll()).filter((l) => l.projectId === projectId);
    const live = entries.filter((e) => e.status !== 'void');
    const jc = computeJobCost({
      budgetLines: budget.map((b) => ({ csiCodeId: b.csiCodeId, amountC: toCents(b.amount) })),
      coCosts: coItems.filter((i) => i.cost != null).map((i) => ({ csiCodeId: i.csiCodeId, amountC: toCents(i.cost ?? 0) })),
      commitments: commitments.map((c) => ({ id: c.id, status: c.status, lines: lines.filter((l) => l.commitmentId === c.id).map((l) => ({ csiCodeId: l.csiCodeId, amountC: toCents(l.amount) })) })),
      costEntries: live.map((e) => ({ commitmentId: e.commitmentId, csiCodeId: e.csiCodeId, amountC: toCents(e.amount), status: e.status })),
      labor: myLabor.map((l) => ({ csiCodeId: l.csiCodeId, costC: burdened(l.wageC, burden), hours: l.hours })),
      reimbursables: reimbs.filter((r) => r.status === 'approved' || r.status === 'billed').map((r) => ({ csiCodeId: r.csiCodeId, costC: toCents(r.cost) })),
      forecasts: new Map(forecasts.map((f) => [f.csiCodeId || NO_CODE, toCents(f.eac)])),
    });
    return { jc, budget, commitments, lines, entries, forecasts, burden, labor: myLabor, reimbs, settings: s.value };
  }

  /** The job-cost view of a project: by cost code, profitability, and the records behind them. */
  async overview(projectId: number, actor: Actor) {
    const rights = await this.canSee(actor);
    await this.fin.project(projectId);
    const [ctx, sovCtx, codes, contractors] = await Promise.all([this.context(projectId), this.fin.context(projectId), this.codes.find(), this.contractors.find()]);
    const sov = computeSov(sovCtx.input);
    const codeOf = new Map(codes.map((c) => [c.id, c]));
    const reimbCostC = sumCents(ctx.reimbs.filter((r) => r.status === 'approved' || r.status === 'billed').map((r) => toCents(r.cost)));
    const prof = profitability({
      contractC: sov.summary.revisedContractC, evC: sov.summary.evC, contractWorkInvoicedC: sov.summary.contractWorkInvoicedC,
      actualC: ctx.jc.totals.actualC, eacC: ctx.jc.totals.eacC, reimbursablesBilledC: sov.summary.reimbursablesBilledC, reimbursableCostC: reimbCostC,
    });
    const billedOn = (id: string) => sumCents(ctx.entries.filter((e) => e.commitmentId === id && e.status !== 'void').map((e) => toCents(e.amount)));
    const rows = ctx.jc.rows.map((r) => ({ ...r, code: r.csiCodeId ? codeOf.get(r.csiCodeId)?.code || '?' : '', division: r.csiCodeId ? codeOf.get(r.csiCodeId)?.division || 'Unknown code' : 'No cost code' }))
      .sort((a, b) => (a.csiCodeId ? 0 : 1) - (b.csiCodeId ? 0 : 1) || a.code.localeCompare(b.code, undefined, { numeric: true }));
    return {
      rights: { manageCosts: rights.manageCosts, approveCosts: rights.approveCosts, viewProfitability: rights.viewProfitability },
      originalBudget: ctx.settings.originalBudget, laborBurdenPct: ctx.burden,
      ...toDollars({ rows, totals: ctx.jc.totals, profitability: prof }),
      budgetLines: ctx.budget.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
      commitments: ctx.commitments.map((c) => {
        const ls = ctx.lines.filter((l) => l.commitmentId === c.id).sort((a, b) => a.lineOrder - b.lineOrder);
        const totalC = sumCents(ls.map((l) => toCents(l.amount)));
        const billedC = billedOn(c.id);
        return { ...c, attachments: normalizeAttachments(c.attachments), sharedAttachments: normalizeAttachments(c.sharedAttachments), lines: ls, ...toDollars({ totalC, billedC, remainingC: c.status === 'approved' ? Math.max(totalC - billedC, 0) : 0 }) };
      }).sort((a, b) => a.number.localeCompare(b.number)),
      entries: ctx.entries.map((e) => ({ ...e, attachments: normalizeAttachments(e.attachments) })).sort((a, b) => b.date.localeCompare(a.date)),
      forecasts: ctx.forecasts,
      labor: summarizeLabor(ctx.labor, ctx.burden),
      contractors: contractors.filter((c) => c.status !== 'ended').map((c) => ({ id: c.id, name: c.companyName })),
    };
  }

  /** Projects with any cost record: budget lines, commitments or cost entries. */
  async projectsWithCosts() {
    const [b, c, e] = await Promise.all([this.budget.find(), this.commitments.find(), this.entries.find()]);
    return Array.from(new Set([...b, ...c, ...e].map((x) => x.projectId)));
  }

  /** The paying side in brief: committed to subcontractors/vendors, paid out, still to pay, and total cost so far. */
  async payingSide(projectId: number, labor?: LaborLine[]) {
    const ctx = await this.context(projectId, labor);
    const live = ctx.entries.filter((e) => e.status !== 'void');
    const unpaidC = sumCents(live.filter((e) => e.status !== 'paid').map((e) => toCents(e.amount)));
    return {
      committedC: ctx.jc.totals.committedC, paidOutC: sumCents(live.filter((e) => e.status === 'paid').map((e) => toCents(e.amount))),
      stillToPayC: unpaidC + ctx.jc.totals.openC, costToDateC: ctx.jc.totals.actualC, costBudgetC: ctx.jc.totals.budgetC, forecastCostC: ctx.jc.totals.eacC,
    };
  }

  // ------------------------------------------------------------------ budget

  async saveBudgetLine(projectId: number, dto: any, actor: Actor) {
    await this.fin.need(actor, 'manageCosts');
    await this.fin.project(projectId);
    let row = dto.id ? await this.budget.findOneBy({ id: dto.id }) : null;
    if (dto.id && !row) throw new NotFoundException('Budget line not found');
    if (row) { assertVersion(row, dto.version); if (row.projectId !== projectId) throw new BadRequestException('That line belongs to another project.'); }
    const before = row ? { ...row } : null;
    row = row || this.budget.create({ id: newId('CB'), projectId, createdAt: now(), createdBy: actor.name });
    if (dto.amount !== undefined) row.amount = money(dto.amount, 'The budget', true);
    if (row.amount == null) throw new BadRequestException('Give the budget amount.');
    for (const k of ['csiCodeId', 'phaseId', 'taskId', 'description', 'notes'] as const) if (dto[k] !== undefined) (row as any)[k] = String(dto[k] ?? '').trim() || null;
    Object.assign(row, { updatedAt: now(), updatedBy: actor.name });
    await this.budget.save(row);
    await this.fin.log(null, { projectId, entityType: 'budget', entityId: row.id, action: before ? 'budget_changed' : 'budget_added', changes: { amount: { from: before?.amount ?? null, to: row.amount } } }, actor);
    return this.overview(projectId, actor);
  }

  async removeBudgetLine(id: string, actor: Actor) {
    await this.fin.need(actor, 'manageCosts');
    const row = await this.budget.findOneBy({ id });
    if (!row) throw new NotFoundException('Budget line not found');
    await this.budget.remove(row);
    await this.fin.log(null, { projectId: row.projectId, entityType: 'budget', entityId: id, action: 'budget_removed', changes: { amount: { from: row.amount, to: null } } }, actor);
    return this.overview(row.projectId, actor);
  }

  /** The team's estimate at completion for a cost code, or clear it to go back to budget-or-spend. */
  async setForecast(projectId: number, dto: { csiCodeId?: string | null; eac?: number | string | null; note?: string }, actor: Actor) {
    await this.fin.need(actor, 'manageCosts');
    const id = `${projectId}:${dto.csiCodeId || NO_CODE}`;
    const row = await this.forecasts.findOneBy({ id });
    if (dto.eac == null || dto.eac === '') {
      if (row) await this.forecasts.remove(row);
    } else {
      const eac = money(dto.eac, 'The forecast', true);
      await this.forecasts.save({ ...(row || { id, projectId, csiCodeId: dto.csiCodeId || null, createdAt: now(), createdBy: actor.name }), eac, note: dto.note?.trim() || null, updatedAt: now(), updatedBy: actor.name } as any);
    }
    await this.fin.log(null, { projectId, entityType: 'forecast', entityId: id, action: 'forecast_set', changes: { eac: { from: row?.eac ?? null, to: dto.eac === '' ? null : dto.eac ?? null } }, reason: dto.note }, actor);
    return this.overview(projectId, actor);
  }

  // ------------------------------------------------------------------ commitments

  private async commitment(id: string) {
    const c = await this.commitments.findOneBy({ id });
    if (!c) throw new NotFoundException('Commitment not found');
    return c;
  }

  private linesFrom(c: CommitmentEntity, dtos: any[]) {
    return dtos.map((d, i) => {
      const description = String(d.description || '').trim();
      if (!description) throw new BadRequestException(`Line ${i + 1}: describe it.`);
      return this.commitmentLines.create({
        id: d.id && String(d.id).startsWith('CML') ? d.id : newId('CML'), commitmentId: c.id, projectId: c.projectId, lineOrder: i, description,
        csiCodeId: d.csiCodeId || null, phaseId: d.phaseId || null, taskId: d.taskId || null, amount: money(d.amount, `Line ${i + 1}'s amount`),
      } as Partial<CommitmentLineEntity>);
    });
  }

  async saveCommitment(projectId: number, dto: any, actor: Actor) {
    const rights = await this.fin.need(actor, 'manageCosts');
    await this.fin.project(projectId);
    let c = dto.id ? await this.commitment(dto.id) : null;
    if (c) {
      assertVersion(c, dto.version);
      if (c.status === 'closed' || c.status === 'void') throw new BadRequestException(`This commitment is ${c.status}.`);
      if (c.status === 'approved' && !rights.approveCosts) throw new BadRequestException('It’s approved -- only someone who approves costs can revise it.');
      if (c.status === 'approved' && dto.lines && !String(dto.reason || '').trim()) throw new BadRequestException('Say why an approved commitment is being revised.');
    }
    const type = COMMITMENT_TYPES.includes(dto.type) ? dto.type : c?.type || 'subcontract';
    const before = c ? { ...c } : null;
    if (!c) {
      const prefix = type === 'subcontract' ? 'SC' : 'PO';
      const existing = (await this.commitments.find({ where: { projectId } })).filter((x) => x.number.startsWith(prefix));
      const n = existing.reduce((m, x) => Math.max(m, Number(x.number.split('-').pop()) || 0), 0) + 1;
      c = this.commitments.create({ id: newId('CM'), projectId, number: `${prefix}-${String(n).padStart(3, '0')}`, type, status: 'draft', attachments: [], createdAt: now(), createdBy: actor.name });
    }
    c.type = type;
    for (const k of ['title', 'vendorName', 'contractorId', 'scope', 'notes'] as const) if (dto[k] !== undefined) (c as any)[k] = String(dto[k] ?? '').trim() || null;
    if (dto.dateIssued !== undefined) { if (dto.dateIssued && !ISO.test(dto.dateIssued)) throw new BadRequestException('The issue date must be a date.'); c.dateIssued = dto.dateIssued || (null as any); }
    if (c.contractorId && !c.vendorName) c.vendorName = (await this.contractors.findOneBy({ id: c.contractorId }))?.companyName as any;
    if (!c.title) throw new BadRequestException('Give it a title.');
    if (!c.vendorName) throw new BadRequestException('Name the subcontractor or vendor.');
    Object.assign(c, { updatedAt: now(), updatedBy: actor.name });
    const old = await this.commitmentLines.find({ where: { commitmentId: c.id } });
    const next = dto.lines ? this.linesFrom(c, dto.lines) : old;
    if (c.status === 'approved') {
      // A revision can't take the commitment below what has already been billed against it.
      const billed = sumCents((await this.entries.find({ where: { commitmentId: c.id } })).filter((e) => e.status !== 'void').map((e) => toCents(e.amount)));
      const total = sumCents(next.map((l) => toCents(l.amount)));
      if (total < billed) throw new BadRequestException(`${fmtUsd(billed)} has already been billed against it -- it can't be revised below that.`);
    }
    await this.commitments.manager.transaction(async (m) => {
      await m.getRepository(CommitmentEntity).save(c!);
      if (dto.lines) {
        const gone = old.filter((o) => !next.some((n) => n.id === o.id));
        if (gone.length) await m.getRepository(CommitmentLineEntity).remove(gone);
        if (next.length) await m.getRepository(CommitmentLineEntity).save(next, { chunk: 40 });
      }
    });
    const totalOf = (ls: { amount: number }[]) => fromCents(sumCents(ls.map((l) => toCents(l.amount))));
    await this.fin.log(null, {
      projectId, entityType: 'commitment', entityId: c.id, action: before ? (before.status === 'approved' ? 'commitment_revised' : 'commitment_changed') : 'commitment_created',
      changes: { total: { from: before ? totalOf(old) : null, to: totalOf(next) }, ...(before ? {} : { number: { from: null, to: c.number } }) }, reason: dto.reason,
    }, actor);
    return this.overview(projectId, actor);
  }

  async commitmentStep(id: string, action: string, dto: { version?: number; reason?: string }, actor: Actor) {
    const c = await this.commitment(id);
    assertVersion(c, dto.version);
    const lines = await this.commitmentLines.find({ where: { commitmentId: id } });
    const at = now();
    const before = c.status;
    if (action === 'approve') {
      await this.fin.need(actor, 'approveCosts');
      if (c.status !== 'draft') throw new BadRequestException(`This commitment is ${c.status}.`);
      if (!lines.length) throw new BadRequestException('Add at least one line first.');
      Object.assign(c, { status: 'approved', approvedAt: at, approvedBy: actor.name, dateIssued: c.dateIssued || todayISO() });
    } else if (action === 'close') {
      await this.fin.need(actor, 'approveCosts');
      if (c.status !== 'approved') throw new BadRequestException('Only an approved commitment can be closed.');
      Object.assign(c, { status: 'closed', closedAt: at, closedBy: actor.name, closedReason: dto.reason?.trim() || 'Complete' });
    } else if (action === 'void') {
      await this.fin.need(actor, 'approveCosts');
      if (!dto.reason?.trim()) throw new BadRequestException('Say why it’s being voided.');
      const billed = (await this.entries.find({ where: { commitmentId: id } })).filter((e) => e.status !== 'void');
      if (billed.length) throw new BadRequestException(`${billed.length} cost(s) are recorded against it -- close it instead, or void those first.`);
      Object.assign(c, { status: 'void', closedAt: at, closedBy: actor.name, closedReason: dto.reason.trim() });
    } else if (action === 'reopen') {
      await this.fin.need(actor, 'approveCosts');
      if (c.status !== 'closed') throw new BadRequestException('Only a closed commitment can be reopened.');
      Object.assign(c, { status: 'approved', closedAt: null, closedBy: null, closedReason: null });
    } else if (action === 'delete') {
      await this.fin.need(actor, 'manageCosts');
      if (c.status !== 'draft') throw new BadRequestException('Only a draft can be deleted -- void it instead.');
      await this.commitments.manager.transaction(async (m) => {
        await m.getRepository(CommitmentLineEntity).delete({ commitmentId: id });
        await m.getRepository(CommitmentEntity).remove(c);
      });
      await this.fin.log(null, { projectId: c.projectId, entityType: 'commitment', entityId: id, action: 'commitment_deleted', changes: { number: { from: c.number, to: null } } }, actor);
      return this.overview(c.projectId, actor);
    } else throw new BadRequestException('Unknown step.');
    Object.assign(c, { updatedAt: at, updatedBy: actor.name });
    await this.commitments.save(c);
    await this.fin.approval(null, { projectId: c.projectId, entityType: 'commitment', entityId: id, decision: action === 'approve' ? 'approved' : action === 'void' ? 'cancelled' : action, comment: dto.reason, amount: fromCents(sumCents(lines.map((l) => toCents(l.amount)))) }, actor);
    await this.fin.log(null, { projectId: c.projectId, entityType: 'commitment', entityId: id, action: ({ approve: 'commitment_approved', close: 'commitment_closed', void: 'commitment_voided', reopen: 'commitment_reopened' } as Record<string, string>)[action], changes: { status: { from: before, to: c.status } }, reason: dto.reason }, actor);
    return this.overview(c.projectId, actor);
  }

  // ------------------------------------------------------------------ cost entries

  private async entry(id: string) {
    const e = await this.entries.findOneBy({ id });
    if (!e) throw new NotFoundException('Cost not found');
    return e;
  }

  async saveEntry(projectId: number, dto: any, actor: Actor) {
    const rights = await this.fin.need(actor, 'manageCosts');
    await this.fin.project(projectId);
    let e = dto.id ? await this.entry(dto.id) : null;
    if (e) {
      assertVersion(e, dto.version);
      if (e.status === 'void') throw new BadRequestException('This cost is void.');
      if (e.status !== 'recorded' && !rights.approveCosts) throw new BadRequestException(`It's ${e.status} -- only someone who approves costs can change it.`);
    }
    const before = e ? { ...e } : null;
    e = e || this.entries.create({ id: newId('CE'), projectId, status: 'recorded', attachments: [], createdAt: now(), createdBy: actor.name });
    if (dto.date !== undefined) { if (!ISO.test(dto.date || '')) throw new BadRequestException('Give the date of the cost.'); e.date = dto.date; }
    if (!e.date) e.date = todayISO();
    if (dto.dueDate !== undefined) { if (dto.dueDate && !ISO.test(dto.dueDate)) throw new BadRequestException('The due date must be a date.'); e.dueDate = dto.dueDate || (null as any); }
    if (dto.type !== undefined) { if (!COST_TYPES.includes(dto.type)) throw new BadRequestException('Unknown cost type.'); e.type = dto.type; }
    if (dto.amount !== undefined) e.amount = money(dto.amount, 'The amount');
    if (!e.amount) throw new BadRequestException('Give the amount.');
    for (const k of ['contractorId', 'vendorName', 'reference', 'commitmentId', 'csiCodeId', 'phaseId', 'taskId', 'description', 'notes'] as const) if (dto[k] !== undefined) (e as any)[k] = String(dto[k] ?? '').trim() || null;
    if (!e.description) throw new BadRequestException('Describe the cost.');
    if (e.contractorId && !e.vendorName) e.vendorName = (await this.contractors.findOneBy({ id: e.contractorId }))?.companyName as any;
    if (e.commitmentId) {
      const c = await this.commitment(e.commitmentId);
      if (c.projectId !== projectId) throw new BadRequestException('That commitment is on another project.');
      if (c.status !== 'approved') throw new BadRequestException(`${c.number} is ${c.status} -- costs go against an approved commitment.`);
      if (!e.vendorName) e.vendorName = c.vendorName;
      if (!e.contractorId && c.contractorId) e.contractorId = c.contractorId;
      // Billing past a commitment is allowed (extras happen) but never silently: the note says by how much.
      const lines = await this.commitmentLines.find({ where: { commitmentId: c.id } });
      const committedC = sumCents(lines.map((l) => toCents(l.amount)));
      const billedC = sumCents((await this.entries.find({ where: { commitmentId: c.id } })).filter((x) => x.status !== 'void' && x.id !== e!.id).map((x) => toCents(x.amount)));
      if (billedC + toCents(e.amount) > committedC && !String(dto.overrideReason || '').trim()) {
        throw new BadRequestException(`This takes ${c.number} to ${fmtUsd(billedC + toCents(e.amount))} billed on a ${fmtUsd(committedC)} commitment. Revise the commitment, or give a reason to record it anyway.`);
      }
    }
    if (!e.dueDate) e.dueDate = addDays(e.date, 30);
    Object.assign(e, { updatedAt: now(), updatedBy: actor.name });
    await this.entries.save(e);
    await this.fin.log(null, { projectId, entityType: 'cost', entityId: e.id, action: before ? 'cost_changed' : 'cost_recorded', changes: { amount: { from: before?.amount ?? null, to: e.amount } }, reason: dto.overrideReason }, actor);
    return this.overview(projectId, actor);
  }

  async entryStep(id: string, action: string, dto: { version?: number; reason?: string; paidDate?: string; paymentRef?: string }, actor: Actor) {
    const e = await this.entry(id);
    assertVersion(e, dto.version);
    const before = e.status;
    const at = now();
    if (action === 'approve') {
      await this.fin.need(actor, 'approveCosts');
      if (e.status !== 'recorded') throw new BadRequestException(`This cost is ${e.status}.`);
      Object.assign(e, { status: 'approved', approvedAt: at, approvedBy: actor.name });
    } else if (action === 'pay') {
      await this.fin.need(actor, 'approveCosts');
      if (e.status !== 'approved') throw new BadRequestException('Approve the cost before marking it paid.');
      const d = dto.paidDate || todayISO();
      if (!ISO.test(d)) throw new BadRequestException('Give the payment date.');
      Object.assign(e, { status: 'paid', paidDate: d, paymentRef: dto.paymentRef?.trim() || null });
    } else if (action === 'void') {
      await this.fin.need(actor, 'approveCosts');
      if (e.status === 'void') throw new BadRequestException('It is already void.');
      if (!dto.reason?.trim()) throw new BadRequestException('Say why it’s being voided.');
      Object.assign(e, { status: 'void', voidReason: dto.reason.trim() });
    } else if (action === 'delete') {
      await this.fin.need(actor, 'manageCosts');
      if (e.status !== 'recorded') throw new BadRequestException('Only an unapproved cost can be deleted -- void it instead.');
      if (e.source === 'portal') throw new BadRequestException('The subcontractor sent this through the portal -- void it with a reason, so they see why it was returned.');
      await this.entries.remove(e);
      await this.attachments?.discardAll(normalizeAttachments(e.attachments));
      await this.fin.log(null, { projectId: e.projectId, entityType: 'cost', entityId: id, action: 'cost_deleted', changes: { amount: { from: e.amount, to: null } } }, actor);
      return this.overview(e.projectId, actor);
    } else throw new BadRequestException('Unknown step.');
    Object.assign(e, { updatedAt: at, updatedBy: actor.name });
    await this.entries.save(e);
    await this.fin.log(null, { projectId: e.projectId, entityType: 'cost', entityId: id, action: ({ approve: 'cost_approved', pay: 'cost_paid', void: 'cost_voided' } as Record<string, string>)[action], changes: { status: { from: before, to: e.status } }, reason: dto.reason }, actor);
    if (e.contractorId) void this.portal?.notifyStatus(e);
    return this.overview(e.projectId, actor);
  }

  // ------------------------------------------------------------------ documents

  private async holder(id: string): Promise<{ save: () => Promise<unknown>; row: { projectId: number; attachments: TaskAttachment[] } }> {
    const c = await this.commitments.findOneBy({ id });
    if (c) return { row: c, save: () => this.commitments.save(c) };
    const e = await this.entries.findOneBy({ id });
    if (e) return { row: e, save: () => this.entries.save(e) };
    throw new NotFoundException('Record not found');
  }
  async addAttachments(id: string, files: any[], actor: UploadActor) {
    const h = await this.holder(id);
    h.row.attachments = [...normalizeAttachments(h.row.attachments), ...(await this.attachments!.upload(files, `Project ${h.row.projectId}`, actor))];
    await h.save();
    return normalizeAttachments(h.row.attachments);
  }
  async addLink(id: string, name: string, url: string, actor: UploadActor) {
    const h = await this.holder(id);
    h.row.attachments = [...normalizeAttachments(h.row.attachments), { id: subId('att'), name: name || url, kind: 'link', url, uploadedBy: actor.name, uploadedById: actor.id, uploadedAt: now() }];
    await h.save();
    return normalizeAttachments(h.row.attachments);
  }
  async removeAttachment(id: string, attId: string) {
    const h = await this.holder(id);
    const all = normalizeAttachments(h.row.attachments);
    const target = all.find((a) => a.id === attId);
    if (!target) throw new NotFoundException('Attachment not found');
    await this.attachments!.discard(target);
    h.row.attachments = all.filter((a) => a.id !== attId);
    await h.save();
    return h.row.attachments;
  }
  async attachment(id: string, attId: string) {
    const att = normalizeAttachments((await this.holder(id)).row.attachments).find((a) => a.id === attId);
    if (!att) throw new NotFoundException('Attachment not found');
    return att;
  }
}

/** Labor for the detail view: by person (hours, overtime, cost) and by week. */
export function summarizeLabor(lines: LaborLine[], burdenPct: number) {
  const byPerson = new Map<string, { employeeId: string; name: string; hours: number; otHours: number; wageC: number; costC: number; rate: number }>();
  const byWeek = new Map<string, { week: string; hours: number; costC: number }>();
  for (const l of lines) {
    const costC = burdened(l.wageC, burdenPct);
    const p = byPerson.get(l.employeeId) || { employeeId: l.employeeId, name: l.name, hours: 0, otHours: 0, wageC: 0, costC: 0, rate: l.rate };
    p.hours += l.hours; p.otHours += l.otHours; p.wageC += l.wageC; p.costC += costC;
    byPerson.set(l.employeeId, p);
    const d = new Date(l.date + 'T00:00:00Z');
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
    const w = byWeek.get(monday) || { week: monday, hours: 0, costC: 0 };
    w.hours += l.hours; w.costC += costC;
    byWeek.set(monday, w);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return toDollars({
    people: Array.from(byPerson.values()).map((p) => ({ ...p, hours: r2(p.hours), otHours: r2(p.otHours) })).sort((a, b) => b.costC - a.costC),
    weeks: Array.from(byWeek.values()).map((w) => ({ ...w, hours: r2(w.hours) })).sort((a, b) => a.week.localeCompare(b.week)),
    hours: r2(lines.reduce((a, l) => a + l.hours, 0)), wageC: sumCents(lines.map((l) => l.wageC)), costC: sumCents(lines.map((l) => burdened(l.wageC, burdenPct))),
  });
}
