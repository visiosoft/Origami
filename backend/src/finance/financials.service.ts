import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  ChangeOrderEntity, ChangeOrderItemEntity, FinanceActivityEntity, FinancialApprovalEntity, LeadEntity, PhaseFinancialEntity, ProgressUpdateEntity,
  ProjectEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, ProjectPhaseEntity, ProjectTaskEntity,
  TaskFinancialEntity,
} from '../database/entities';
import { ManpowerAccess, type Actor } from '../manpower/manpower-access.service';
import { SettingsService } from '../settings/settings.service';
import { brandingFrom } from '../documents/letterhead';
import { DEFAULT_LIBRARY, DEFAULT_TEMPLATE_KEY, parseLibrary, parseProgramme, phaseCategorizer, type ProgrammeTemplateDef } from '../seed-data/programme-template';
import { newId, todayISO } from '../manpower/workforce.util';
import { computeSov, lineMath, toDollars, type Category, type IssuedLine, type ItemFin, type SovInput } from './finance.calc';
import { fromCents, roundPct, sumCents, toCents } from './money';

export const FIN_MODULE = 'fin_project';
export const PM_MODULE = 'pm';
export const CO_MODULE = 'changeorders';
export const REIMB_MODULE = 'reimbursement';

/**
 * Financial actions a role can be given one by one (Admin -> Roles, "Financial actions").
 * A role that has never had a key set falls back to Project Financials -> manage, so
 * roles set up before these existed keep working as they did.
 */
export const FIN_ACTIONS = {
  prepareInvoice: 'finx_prepare_invoice',
  issueInvoice: 'finx_issue_invoice',
  recordPayment: 'finx_record_payment',
  approveProgress: 'finx_approve_progress',
  approveChangeOrders: 'finx_approve_co',
  approveReimbursables: 'finx_approve_reimb',
  releaseRetention: 'finx_release_retention',
  manageCosts: 'finx_manage_costs',
  approveCosts: 'finx_approve_costs',
  viewProfitability: 'finx_view_profitability',
} as const;
export type FinRights = {
  view: boolean; manage: boolean; reportProgress: boolean;
  viewChangeOrders: boolean; editChangeOrders: boolean; viewReimbursables: boolean; submitReimbursables: boolean;
} & { [K in keyof typeof FIN_ACTIONS]: boolean };

/** Open change orders: counted as pending, not yet in the contract. */
export const CO_OPEN = ['internal_review', 'submitted'];
export const BILLING_METHODS = ['fixed', 'percent_complete', 'quantity', 't_and_m', 'reimbursable', 'milestone', 'manual'];

type ItemKind = 'project' | 'phase' | 'task';
const now = () => new Date().toISOString();

/** The stale-write guard: an update must carry the version it read. */
export function assertVersion(row: { version?: number; updatedBy?: string } | null | undefined, version: unknown) {
  if (!row) return;
  if (version == null || Number(version) !== Number(row.version)) {
    throw new ConflictException(`This was changed${row.updatedBy ? ` by ${row.updatedBy}` : ''} since you opened it -- reload and try again.`);
  }
}

const pctIn = (v: unknown, name: string) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new BadRequestException(`${name} must be between 0 and 100.`);
  return roundPct(n);
};
const moneyIn = (v: unknown, name: string): number | null => {
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e13) throw new BadRequestException(`${name} must be a positive amount.`);
  return fromCents(toCents(n));
};
const fmtUsd = (c: number) => (c < 0 ? '-$' : '$') + Math.round(Math.abs(c) / 100).toLocaleString('en-US');
const DENIED: Partial<Record<keyof FinRights, string>> = {
  view: "Your role doesn't include project financials.",
  prepareInvoice: "Your role doesn't allow preparing invoices.",
  issueInvoice: "Your role doesn't allow issuing, voiding or crediting invoices.",
  recordPayment: "Your role doesn't allow recording payments.",
  approveProgress: "Your role doesn't allow approving progress.",
  approveChangeOrders: "Your role doesn't allow approving change orders.",
  editChangeOrders: "Your role doesn't allow preparing change orders.",
  viewChangeOrders: "Your role doesn't include change orders.",
  approveReimbursables: "Your role doesn't allow approving reimbursables.",
  submitReimbursables: "Your role doesn't allow submitting reimbursables.",
  viewReimbursables: "Your role doesn't include reimbursables.",
  releaseRetention: "Your role doesn't allow releasing retention.",
  manageCosts: "Your role doesn't allow recording budgets, commitments or costs.",
  approveCosts: "Your role doesn't allow approving commitments or costs.",
  viewProfitability: "Your role doesn't include job cost and profitability.",
};

@Injectable()
export class FinancialsService {
  constructor(
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(LeadEntity) private readonly leads: Repository<LeadEntity>,
    @InjectRepository(ProjectPhaseEntity) private readonly phases: Repository<ProjectPhaseEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly tasks: Repository<ProjectTaskEntity>,
    @InjectRepository(ProjectFinancialEntity) private readonly pfin: Repository<ProjectFinancialEntity>,
    @InjectRepository(PhaseFinancialEntity) private readonly phfin: Repository<PhaseFinancialEntity>,
    @InjectRepository(TaskFinancialEntity) private readonly tfin: Repository<TaskFinancialEntity>,
    @InjectRepository(ProgressUpdateEntity) private readonly progress: Repository<ProgressUpdateEntity>,
    @InjectRepository(ProjectInvoiceEntity) private readonly invoices: Repository<ProjectInvoiceEntity>,
    @InjectRepository(ProjectInvoiceLineEntity) private readonly lines: Repository<ProjectInvoiceLineEntity>,
    @InjectRepository(ProjectPaymentEntity) private readonly payments: Repository<ProjectPaymentEntity>,
    @InjectRepository(FinanceActivityEntity) private readonly activityRepo: Repository<FinanceActivityEntity>,
    private readonly settings: SettingsService,
    readonly access: ManpowerAccess,
    @InjectRepository(ChangeOrderEntity) readonly changeOrders: Repository<ChangeOrderEntity>,
    @InjectRepository(ChangeOrderItemEntity) readonly coItems: Repository<ChangeOrderItemEntity>,
    @InjectRepository(FinancialApprovalEntity) readonly approvals: Repository<FinancialApprovalEntity>,
  ) {}

  // ------------------------------------------------------------------ access

  async rights(actor: Actor): Promise<FinRights> {
    const perms = await this.access.permissionsOf(actor);
    const has = (key: string, action: 'view' | 'manage') => perms === 'all' || !!perms?.[key]?.[action];
    const view = has(FIN_MODULE, 'view') || has(FIN_MODULE, 'manage');
    const manage = has(FIN_MODULE, 'manage');
    // A granular action: its own setting when the role has one, else Project Financials -> manage.
    const action = (key: string) => (perms === 'all' ? true : perms && perms[key] ? !!perms[key].manage : manage);
    const out = { view, manage, reportProgress: manage || has(PM_MODULE, 'manage') } as FinRights;
    for (const [name, key] of Object.entries(FIN_ACTIONS)) (out as any)[name] = action(key);
    out.viewChangeOrders = view || has(CO_MODULE, 'view');
    out.editChangeOrders = manage || has(CO_MODULE, 'manage');
    out.viewReimbursables = view || has(REIMB_MODULE, 'view');
    out.submitReimbursables = manage || has(REIMB_MODULE, 'manage');
    return out;
  }

  async need(actor: Actor, what: keyof FinRights) {
    const r = await this.rights(actor);
    if (!r[what]) throw new ForbiddenException(DENIED[what] || "Your role doesn't allow changing project financials.");
    return r;
  }

  /** A decision on a financial record, kept alongside the activity log. */
  async approval(m: EntityManager | null, e: { projectId: number; entityType: string; entityId: string; decision: string; comment?: string; signer?: string; amount?: number | null }, actor: Actor) {
    const repo = m ? m.getRepository(FinancialApprovalEntity) : this.approvals;
    await repo.save(repo.create({ id: newId('AP'), ...e, comment: e.comment?.trim() || undefined, byName: actor.name, byId: actor.id, at: now() }));
  }

  async approvalsFor(entityId: string) {
    return (await this.approvals.find({ where: { entityId } })).sort((a, b) => a.at.localeCompare(b.at));
  }

  /** The next per-project number (CO-001, RE-001, RR-001); the unique index is the backstop against a race. */
  async nextProjectNumber(repo: Repository<{ number: string; projectId: number } & any>, projectId: number, prefix: string) {
    const rows = await repo.find({ where: { projectId } });
    const max = rows.reduce((m: number, r: any) => Math.max(m, Number(String(r.number).split('-').pop()) || 0), 0);
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
  }

  // ------------------------------------------------------------------ audit

  async log(m: EntityManager | null, e: { projectId: number; entityType: string; entityId: string; action: string; changes?: Record<string, { from: unknown; to: unknown }> | null; reason?: string }, actor: Actor) {
    const repo = m ? m.getRepository(FinanceActivityEntity) : this.activityRepo;
    await repo.save(repo.create({ id: newId('FA'), ...e, changes: e.changes && Object.keys(e.changes).length ? e.changes : null, byName: actor.name, byId: actor.id, at: now() }));
  }

  private diff<T extends object>(row: T, patch: Partial<T>) {
    const out: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(patch)) {
      const before = (row as any)[k];
      if (v !== undefined && String(before ?? '') !== String(v ?? '')) out[k] = { from: before ?? null, to: v ?? null };
    }
    return out;
  }

  // ------------------------------------------------------------------ reading

  private async library(): Promise<ProgrammeTemplateDef[]> {
    try { const lib = parseLibrary(await this.settings.get('programme.templates')); if (lib) return lib; } catch { /* legacy next */ }
    try { const legacy = parseProgramme(await this.settings.get('programme.template')); if (legacy) return [{ key: DEFAULT_TEMPLATE_KEY, name: 'Default', phases: legacy, category: 'design' }]; } catch { /* default */ }
    return DEFAULT_LIBRARY;
  }

  /** Design or construction, the way the boards decide it; anything else (e.g. milestones added here) is Other. */
  async categories(project: ProjectEntity) {
    const cat = phaseCategorizer(await this.library(), project.templateKey);
    return (key: string): Category => cat(key);
  }

  async project(projectId: number) {
    const p = await this.projects.findOneBy({ id: projectId });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  /** Settings row, or unsaved defaults (version 0) for a project not set up yet. */
  async settingsFor(projectId: number) {
    const row = await this.pfin.findOneBy({ projectId });
    return { row, exists: !!row, value: row || ({ projectId, currency: 'USD', fxRate: 1, originalContractValue: 0, originalBudget: null, retentionPct: 0, taxPct: 0, reimbursableMarkupPct: 0, laborBurdenPct: 0, paymentTermsDays: 30, requireProgressApproval: false, reportedProgress: 0, approvedProgress: 0, version: 0 } as unknown as ProjectFinancialEntity) };
  }

  /** Everything the schedule of values is computed from. */
  async context(projectId: number): Promise<{ input: SovInput; settings: ProjectFinancialEntity; exists: boolean; phaseRows: ProjectPhaseEntity[]; taskRows: ProjectTaskEntity[] }> {
    const project = await this.project(projectId);
    const [{ value: s, exists }, phaseRows, taskRows, phf, tf, invs, lineRows, pays, cat, cos, coItemRows] = await Promise.all([
      this.settingsFor(projectId),
      this.phases.find({ where: { projectId } }),
      this.tasks.find({ where: { projectId } }),
      this.phfin.find({ where: { projectId } }),
      this.tfin.find({ where: { projectId } }),
      this.invoices.find({ where: { projectId, status: 'issued' } }),
      this.lines.find({ where: { projectId } }),
      this.payments.find({ where: { projectId } }),
      this.categories(project),
      this.changeOrders.find({ where: { projectId } }),
      this.coItems.find({ where: { projectId } }),
    ]);
    const issued = new Set(invs.map((x) => x.id));
    const co = changeOrderFigures(cos, coItemRows);
    const lines: IssuedLine[] = lineRows.filter((l) => issued.has(l.invoiceId)).map((l) => ({
      id: l.id, invoiceId: l.invoiceId, kind: l.kind, targetType: l.targetType, phaseId: l.phaseId, taskId: l.taskId,
      amountC: toCents(l.amount), retentionC: toCents(l.retentionAmount), taxC: toCents(l.taxAmount),
    }));
    const fin = (r: ItemFin & { version?: number }) => r;
    return {
      settings: s, exists, phaseRows, taskRows,
      input: {
        originalContractC: toCents(s.originalContractValue), approvedChangesC: co.approvedC, requireApproval: !!s.requireProgressApproval,
        coAdjust: co.adjust, pendingChangesC: co.pendingC,
        project: { contractValue: null, reportedProgress: Number(s.reportedProgress) || 0, approvedProgress: Number(s.approvedProgress) || 0, version: s.version },
        phases: phaseRows.map((p) => ({ id: p.id, key: p.key, name: p.name, order: p.order, category: cat(p.key) })),
        tasks: taskRows.filter((t) => !t.parentId).map((t) => ({ id: t.id, title: t.title, phaseId: t.phaseId || null, done: !!t.completed || t.status === 'Done', order: t.order || 0 })),
        phaseFin: new Map(phf.map((r) => [r.phaseId, fin(r)])),
        taskFin: new Map(tf.map((r) => [r.taskId, fin(r)])),
        lines, invoices: invs.map((x) => ({ id: x.id, totalC: toCents(x.total), dueDate: x.dueDate, creditForId: x.creditForInvoiceId || null })),
        payments: pays.filter((p) => !p.voidedAt && issued.has(p.invoiceId)).map((p) => ({ invoiceId: p.invoiceId, amountC: toCents(p.amount) })),
        today: todayISO(),
      },
    };
  }

  async overview(projectId: number, actor: Actor) {
    const rights = await this.need(actor, 'view');
    const project = await this.project(projectId);
    const ctx = await this.context(projectId);
    const sov = computeSov(ctx.input);
    const [drafts, lead] = await Promise.all([
      this.invoices.count({ where: { projectId, status: 'draft' } }),
      project.leadId ? this.leads.findOneBy({ id: project.leadId }) : Promise.resolve(null),
    ]);
    return {
      project: { id: project.id, name: project.name, contractAmt: project.contractAmt, stage: project.stage },
      settings: { ...ctx.settings, exists: ctx.exists },
      billToDefaults: lead ? billToFromLead(lead) : null,
      suggestedContract: fromCents(toCents(parseAmount(project.contractAmt))),
      sov: toDollars(sov), drafts, rights,
      // Board tasks outside any phase that don't carry a value yet -- offered when adding one to the schedule.
      looseTasks: ctx.input.tasks.filter((t) => !t.phaseId && ctx.input.taskFin.get(t.id)?.contractValue == null).map((t) => ({ id: t.id, title: t.title })),
    };
  }

  // ------------------------------------------------------------------ project settings

  async saveSettings(projectId: number, dto: any, actor: Actor) {
    await this.need(actor, 'manage');
    const project = await this.project(projectId);
    const { row } = await this.settingsFor(projectId);
    if (row) assertVersion(row, dto.version);
    const patch: Partial<ProjectFinancialEntity> = {};
    if (dto.originalContractValue !== undefined) {
      const v = moneyIn(dto.originalContractValue, 'The contract value') ?? 0;
      if (row?.contractLockedAt && toCents(v) !== toCents(row.originalContractValue)) {
        throw new BadRequestException('Invoices have been issued against this contract -- the original value is locked. Record a change order instead.');
      }
      patch.originalContractValue = v;
    }
    if (dto.originalBudget !== undefined) patch.originalBudget = moneyIn(dto.originalBudget, 'The budget');
    if (dto.retentionPct !== undefined) patch.retentionPct = pctIn(dto.retentionPct, 'Retention');
    if (dto.taxPct !== undefined) patch.taxPct = pctIn(dto.taxPct, 'Tax');
    if (dto.reimbursableMarkupPct !== undefined) patch.reimbursableMarkupPct = pctIn(dto.reimbursableMarkupPct, 'Reimbursable markup');
    if (dto.laborBurdenPct !== undefined) {
      const n = Number(dto.laborBurdenPct);
      if (!Number.isFinite(n) || n < 0 || n > 200) throw new BadRequestException('Labor burden must be between 0 and 200%.');
      patch.laborBurdenPct = roundPct(n);
    }
    if (dto.paymentTermsDays !== undefined) {
      const d = Number(dto.paymentTermsDays);
      if (!Number.isInteger(d) || d < 0 || d > 365) throw new BadRequestException('Payment terms are 0-365 days.');
      patch.paymentTermsDays = d;
    }
    if (dto.requireProgressApproval !== undefined) patch.requireProgressApproval = !!dto.requireProgressApproval;
    for (const k of ['billToName', 'billToEmail', 'billToAddress', 'contractNumber', 'poNumber', 'notes'] as const) if (dto[k] !== undefined) (patch as any)[k] = String(dto[k] ?? '').trim() || null;

    // The contract can't drop below what's already allocated to milestones and tasks.
    if (patch.originalContractValue !== undefined) {
      const sov = computeSov((await this.context(projectId)).input);
      if (!sov.summary.lumpSum && toCents(patch.originalContractValue) < sov.summary.allocatedC) {
        throw new BadRequestException(`${fmtUsd(sov.summary.allocatedC)} is already allocated to milestones and tasks -- lower those first.`);
      }
    }
    const base = row || this.pfin.create({ ...(await this.settingsFor(projectId)).value, createdAt: now(), createdBy: actor.name });
    const changes = this.diff(base, patch);
    Object.assign(base, patch, { updatedAt: now(), updatedBy: actor.name });
    const saved = await this.pfin.save(base);
    if (patch.originalContractValue !== undefined) {
      // Keep the project card's display text in step with the real figure.
      await this.projects.update({ id: projectId }, { contractAmt: fmtUsd(toCents(saved.originalContractValue)) });
    }
    await this.log(null, { projectId, entityType: 'project', entityId: String(projectId), action: row ? 'settings_changed' : 'financials_set_up', changes }, actor);
    return this.overview(project.id, actor);
  }

  // ------------------------------------------------------------------ item values

  private async target(kind: ItemKind, id: string) {
    if (kind === 'phase') {
      const ph = await this.phases.findOneBy({ id });
      if (!ph) throw new NotFoundException('Milestone not found');
      return { projectId: ph.projectId, phaseId: ph.id, name: ph.name };
    }
    if (kind === 'task') {
      const t = await this.tasks.findOneBy({ id });
      if (!t || t.projectId == null) throw new NotFoundException('Task not found');
      if (t.parentId) throw new BadRequestException('Values go on tasks, not subtasks.');
      return { projectId: t.projectId, phaseId: t.phaseId || null, name: t.title };
    }
    throw new BadRequestException('Unknown item.');
  }

  private finRepo(kind: 'phase' | 'task') { return kind === 'phase' ? this.phfin : this.tfin; }
  private async finRow(kind: 'phase' | 'task', id: string) {
    return kind === 'phase' ? this.phfin.findOneBy({ phaseId: id }) : this.tfin.findOneBy({ taskId: id });
  }

  async updateItem(kind: 'phase' | 'task', id: string, dto: any, actor: Actor) {
    await this.need(actor, 'manage');
    const t = await this.target(kind, id);
    const row = await this.finRow(kind, id);
    if (row) assertVersion(row, dto.version);
    const ctx = await this.context(t.projectId);
    const sov = computeSov(ctx.input);
    const flat = sov.groups.flatMap((g) => g.rows.flatMap((r) => [r, ...(r.children || [])]));
    const me = flat.find((r) => r.kind === kind && r.id === id);

    const patch: Record<string, unknown> = {};
    if (dto.contractValue !== undefined) {
      const v = moneyIn(dto.contractValue, 'The value');
      const vC = v == null ? null : toCents(v);
      if (kind === 'phase' && me?.valueFromTasks && vC != null) throw new BadRequestException("This milestone's value comes from its tasks -- set values on the tasks instead.");
      if (kind === 'task' && t.phaseId) {
        const parent = flat.find((r) => r.kind === 'phase' && r.id === t.phaseId);
        if (parent?.billedAsWhole && vC != null) throw new BadRequestException('This milestone has been invoiced as a whole -- its tasks can’t take separate values now.');
        if (parent && !parent.valueFromTasks && parent.ownValueC != null && vC != null) throw new BadRequestException(`${parent.name} has its own value. Clear it before splitting it across tasks.`);
      }
      const invoicedC = me?.invoicedC || 0;
      const coC = me?.changeOrdersC || 0;
      if ((vC ?? 0) + coC < invoicedC) throw new BadRequestException(`${fmtUsd(invoicedC)} has already been invoiced against this -- the value can't go below that.`);
      const oldC = me?.ownValueC ?? 0;
      const newAllocated = sov.summary.allocatedC - oldC + (vC ?? 0);
      const revised = sov.summary.revisedContractC;
      if ((vC ?? 0) > oldC && newAllocated > revised) {
        throw new BadRequestException(`That would allocate ${fmtUsd(newAllocated)} against a ${fmtUsd(revised)} contract. Only ${fmtUsd(Math.max(revised - sov.summary.allocatedC, 0))} is unallocated.`);
      }
      patch.contractValue = v;
    }
    for (const k of ['budgetedCost', 'estimatedCost'] as const) if (dto[k] !== undefined) patch[k] = moneyIn(dto[k], 'Cost');
    if (dto.billingMethod !== undefined) {
      if (!BILLING_METHODS.includes(dto.billingMethod)) throw new BadRequestException('Unknown billing method.');
      patch.billingMethod = dto.billingMethod;
    }
    for (const k of ['retentionPctOverride', 'taxPctOverride'] as const) {
      if (dto[k] !== undefined) patch[k] = dto[k] === null || dto[k] === '' ? null : pctIn(dto[k], k.startsWith('ret') ? 'Retention' : 'Tax');
    }
    for (const k of ['csiCodeId', 'subcontractorTradeId', 'deliverables', 'requiredFromUs', 'requiredFromClient', 'requiredFromContractor', 'acceptanceCriteria', 'billingCondition', 'notes']) {
      if (dto[k] !== undefined) patch[k] = String(dto[k] ?? '').trim() || null;
    }
    const repo = this.finRepo(kind) as Repository<any>;
    const base = row || repo.create({
      [kind === 'phase' ? 'phaseId' : 'taskId']: id, projectId: t.projectId, ...(kind === 'task' ? { phaseId: t.phaseId } : {}),
      contractValue: null, reportedProgress: 0, approvedProgress: 0, billingMethod: 'percent_complete', createdAt: now(), createdBy: actor.name,
    });
    const changes = this.diff(base, patch as any);
    Object.assign(base, patch, { updatedAt: now(), updatedBy: actor.name });
    await repo.save(base);
    await this.log(null, { projectId: t.projectId, entityType: kind, entityId: id, action: row ? 'item_changed' : 'item_set_up', changes }, actor);
    return this.overview(t.projectId, actor);
  }

  // ------------------------------------------------------------------ progress

  /** Reported progress: 0-100; a reduction needs a reason. Approved progress follows it down, never above it. */
  async reportProgress(kind: ItemKind, id: string, dto: { pct: number; reason?: string; version?: number }, actor: Actor, projectIdForLump?: number) {
    await this.need(actor, 'reportProgress');
    return this.changeProgress(kind, id, 'reported', dto, actor, projectIdForLump);
  }

  async approveProgress(kind: ItemKind, id: string, dto: { pct?: number; reason?: string; version?: number }, actor: Actor, projectIdForLump?: number) {
    await this.need(actor, 'approveProgress');
    return this.changeProgress(kind, id, 'approved', dto, actor, projectIdForLump);
  }

  private async changeProgress(kind: ItemKind, id: string, which: 'reported' | 'approved', dto: { pct?: number; reason?: string; version?: number }, actor: Actor, projectIdForLump?: number) {
    let projectId: number;
    let row: any;
    let repo: Repository<any>;
    if (kind === 'project') {
      projectId = Number(projectIdForLump ?? id);
      await this.project(projectId);
      const s = await this.settingsFor(projectId);
      if (!s.row) throw new BadRequestException('Set up this project’s financials first.');
      row = s.row; repo = this.pfin;
    } else {
      const t = await this.target(kind, id);
      projectId = t.projectId;
      if (kind === 'phase') {
        const sov = computeSov((await this.context(projectId)).input);
        const me = sov.groups.flatMap((g) => g.rows).find((r) => r.id === id);
        if (me?.valueFromTasks) throw new BadRequestException("This milestone's progress comes from its tasks -- update them instead.");
      }
      repo = this.finRepo(kind) as Repository<any>;
      row = await this.finRow(kind, id);
      if (!row) {
        row = repo.create({ [kind === 'phase' ? 'phaseId' : 'taskId']: id, projectId, ...(kind === 'task' ? { phaseId: t.phaseId } : {}), contractValue: null, reportedProgress: 0, approvedProgress: 0, billingMethod: 'percent_complete', createdAt: now(), createdBy: actor.name });
        row.version = undefined;
      }
    }
    if (row.version) assertVersion(row, dto.version);
    const reported = Number(row.reportedProgress) || 0;
    const approved = Number(row.approvedProgress) || 0;
    const from = which === 'reported' ? reported : approved;
    const to = pctIn(dto.pct ?? (which === 'approved' ? reported : undefined), which === 'reported' ? 'Progress' : 'Approved progress');
    if (to < from && !dto.reason?.trim()) throw new BadRequestException('Say why progress is going down.');
    if (which === 'approved' && to > reported) throw new BadRequestException(`Approved progress can't be above the reported ${reported}%.`);
    const at = now();
    const updates: Partial<ProgressUpdateEntity>[] = [{ kind: which, fromPct: from, toPct: to }];
    if (which === 'reported') {
      row.reportedProgress = to;
      if (approved > to) { row.approvedProgress = to; updates.push({ kind: 'approved', fromPct: approved, toPct: to }); }
    } else {
      row.approvedProgress = to;
      if (kind !== 'project') Object.assign(row, { progressApprovedBy: actor.name, progressApprovedAt: at });
    }
    Object.assign(row, { updatedAt: at, updatedBy: actor.name });
    await repo.save(row);
    for (const u of updates) {
      await this.progress.save(this.progress.create({ id: newId('PU'), projectId, targetType: kind, targetId: kind === 'project' ? String(projectId) : id, ...u, reason: dto.reason?.trim() || undefined, byName: actor.name, byId: actor.id, at }));
      await this.log(null, { projectId, entityType: kind, entityId: kind === 'project' ? String(projectId) : id, action: `progress_${u.kind}`, changes: { progress: { from: u.fromPct, to: u.toPct } }, reason: dto.reason?.trim() }, actor);
    }
    if (which === 'approved') await this.approval(null, { projectId, entityType: 'progress', entityId: kind === 'project' ? String(projectId) : id, decision: 'approved', comment: `${kind} progress ${from}% → ${to}%` }, actor);
    return this.overview(projectId, actor);
  }

  async progressHistory(kind: ItemKind, id: string, actor: Actor) {
    await this.need(actor, 'view');
    return (await this.progress.find({ where: { targetType: kind, targetId: id } })).sort((a, b) => b.at.localeCompare(a.at));
  }

  // ------------------------------------------------------------------ structure

  /** A billing milestone added from the Financial tab: an ordinary project phase, so the project keeps one structure. */
  async addMilestone(projectId: number, dto: { name: string; contractValue?: number | null }, actor: Actor) {
    await this.need(actor, 'manage');
    await this.project(projectId);
    const name = String(dto.name || '').trim();
    if (!name) throw new BadRequestException('Name the milestone.');
    const existing = await this.phases.find({ where: { projectId } });
    const key = 'fin-' + Date.now().toString(36);
    const phase = await this.phases.save(this.phases.create({
      id: `PH-${projectId}-${key}`, projectId, key, name, color: '#7E9B93', order: existing.reduce((m, p) => Math.max(m, p.order), -1) + 1,
    }));
    await this.log(null, { projectId, entityType: 'phase', entityId: phase.id, action: 'milestone_added', changes: { name: { from: null, to: name } } }, actor);
    if (dto.contractValue != null && dto.contractValue !== ('' as any)) return this.updateItem('phase', phase.id, { contractValue: dto.contractValue }, actor);
    return this.overview(projectId, actor);
  }

  // ------------------------------------------------------------------ drill-down and history

  /** Every invoice containing an item (a milestone includes its tasks' lines). */
  async itemInvoices(kind: ItemKind, id: string, actor: Actor) {
    await this.need(actor, 'view');
    let rows: ProjectInvoiceLineEntity[];
    if (kind === 'project') rows = await this.lines.find({ where: { projectId: Number(id), targetType: 'project' } });
    else if (kind === 'task') rows = await this.lines.find({ where: { taskId: id } });
    else {
      const ph = await this.phases.findOneBy({ id });
      const taskIds = ph ? new Set((await this.tasks.find({ where: { phaseId: id } })).map((t) => t.id)) : new Set<string>();
      rows = (await this.lines.find({ where: { projectId: ph?.projectId ?? -1 } })).filter((l) => l.phaseId === id || (l.taskId && taskIds.has(l.taskId)));
    }
    const invs = new Map((await this.invoices.find({ where: { projectId: rows[0]?.projectId ?? -1 } })).map((x) => [x.id, x]));
    return rows.filter((l) => invs.has(l.invoiceId)).map((l) => {
      const inv = invs.get(l.invoiceId)!;
      return {
        invoiceId: inv.id, number: inv.issuedNumber, status: inv.status, invoiceDate: inv.invoiceDate, description: l.description,
        amount: l.amount, retention: l.retentionAmount, net: fromCents(lineMath({ kind: l.kind, amountC: toCents(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct }).netC),
        prevProgressPct: l.prevProgressPct, currentProgressPct: l.currentProgressPct,
      };
    }).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
  }

  /** The letterhead bits an invoice prints with -- read-only, so finance staff don't need settings access. */
  async brand(actor: Actor) {
    await this.need(actor, 'view');
    const keys = ['companyName', 'tagline', 'logoDataUrl', 'accentColor', 'address', 'phone', 'email', 'website', 'footerNote'].map((k) => `brand.${k}`);
    const b = brandingFrom(await this.settings.getMany(keys));
    return { companyName: b.companyName, tagline: b.tagline, logoDataUrl: b.logoDataUrl, accentColor: b.accentColor, address: b.address, phone: b.phone, email: b.email, website: b.website, footerNote: b.footerNote };
  }

  async activity(projectId: number, actor: Actor) {
    await this.need(actor, 'view');
    return (await this.activityRepo.find({ where: { projectId } })).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
  }
}

/** "$1,150,000" / "1.2M" / "780k" -> dollars; anything unreadable -> 0. */
export function parseAmount(s: string | null | undefined): number {
  if (!s) return 0;
  const m = String(s).replace(/[, $]/g, '').match(/^(\d+(?:\.\d+)?)([kKmM])?/);
  if (!m) return 0;
  const n = Number(m[1]) * (m[2] ? (m[2].toLowerCase() === 'm' ? 1e6 : 1e3) : 1);
  return Number.isFinite(n) ? n : 0;
}

/** Who to bill, from the project's lead: business or contact name, email, billing (else mailing) address. */
export function billToFromLead(lead: LeadEntity) {
  const addrs = (lead.addresses || {}) as Record<string, any>;
  const a = addrs.billing || addrs.businessMailing || null;
  const line = a && typeof a === 'object' ? [a.street || a.line1 || a.address, a.address2 || a.line2, [a.city, a.state].filter(Boolean).join(', '), a.zip || a.zipCode || a.postalCode].filter(Boolean).join('\n') : '';
  return { name: lead.businessName || lead.leadName, email: lead.email || '', address: line };
}

/**
 * Approved change orders by the item they change, their total, and what's still
 * open. Approved amounts use the snapshot taken at approval.
 */
export function changeOrderFigures(cos: ChangeOrderEntity[], items: ChangeOrderItemEntity[]) {
  const approved = new Set(cos.filter((c) => c.status === 'approved').map((c) => c.id));
  const open = new Set(cos.filter((c) => CO_OPEN.includes(c.status)).map((c) => c.id));
  const adjust = new Map<string, number>();
  for (const it of items) {
    if (!approved.has(it.changeOrderId)) continue;
    const key = it.taskId ? `task:${it.taskId}` : it.phaseId && (it.targetType === 'phase' || it.targetType === 'new_phase') ? `phase:${it.phaseId}` : null;
    if (key) adjust.set(key, (adjust.get(key) || 0) + toCents(it.amount));
  }
  return {
    adjust,
    approvedC: sumCents(cos.filter((c) => approved.has(c.id)).map((c) => toCents(c.amount ?? 0))),
    pendingC: sumCents(items.filter((i) => open.has(i.changeOrderId)).map((i) => toCents(i.amount))),
  };
}
