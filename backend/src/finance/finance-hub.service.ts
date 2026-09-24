import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ChangeOrderEntity, ChangeOrderItemEntity, FinanceActivityEntity, PhaseFinancialEntity, ProjectEntity, ProjectFinancialEntity, ProjectInvoiceEntity,
  ProjectInvoiceLineEntity, ProjectPhaseEntity, ProjectTaskEntity, ReimbursableEntity, RetentionReleaseEntity, TaskFinancialEntity,
} from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { computeSov, invoiceTotals, toDollars } from './finance.calc';
import { FinancialsService } from './financials.service';
import { reimbursableBillC } from './invoices.service';
import { CostsService } from './costs.service';
import { fromCents, sumCents, toCents } from './money';

/** One thing waiting on someone's decision, wherever it lives. */
export interface Pending {
  type: 'change_order' | 'reimbursable' | 'retention_release' | 'invoice' | 'progress';
  id: string; projectId: number; projectName: string; title: string; detail: string; amount: number | null; since: string; canAct: boolean;
  itemKind?: string;
}

/**
 * Finance across projects: the approvals inbox, the portfolio of project
 * financials, and the audit log.
 */
@Injectable()
export class FinanceHubService {
  constructor(
    private readonly fin: FinancialsService,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectFinancialEntity) private readonly pfin: Repository<ProjectFinancialEntity>,
    @InjectRepository(ChangeOrderEntity) private readonly cos: Repository<ChangeOrderEntity>,
    @InjectRepository(ChangeOrderItemEntity) private readonly coItems: Repository<ChangeOrderItemEntity>,
    @InjectRepository(ReimbursableEntity) private readonly reimbs: Repository<ReimbursableEntity>,
    @InjectRepository(RetentionReleaseEntity) private readonly releases: Repository<RetentionReleaseEntity>,
    @InjectRepository(ProjectInvoiceEntity) private readonly invoices: Repository<ProjectInvoiceEntity>,
    @InjectRepository(PhaseFinancialEntity) private readonly phfin: Repository<PhaseFinancialEntity>,
    @InjectRepository(TaskFinancialEntity) private readonly tfin: Repository<TaskFinancialEntity>,
    @InjectRepository(ProjectPhaseEntity) private readonly phases: Repository<ProjectPhaseEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly tasks: Repository<ProjectTaskEntity>,
    @InjectRepository(FinanceActivityEntity) private readonly activity: Repository<FinanceActivityEntity>,
    @InjectRepository(ProjectInvoiceLineEntity) private readonly lines: Repository<ProjectInvoiceLineEntity>,
    private readonly costs?: CostsService,
  ) {}

  private async names() {
    return new Map((await this.projects.find()).map((p) => [p.id, p.name]));
  }

  /** Everything waiting for a decision that this person can see, flagged where they can make it. */
  async pending(actor: Actor) {
    const r = await this.fin.rights(actor);
    const name = await this.names();
    const pn = (id: number) => name.get(id) || `Project ${id}`;
    const out: Pending[] = [];
    if (r.viewChangeOrders) {
      const open = await this.cos.find({ where: { status: In(['internal_review', 'submitted']) } });
      const items = open.length ? await this.coItems.find({ where: { changeOrderId: In(open.map((c) => c.id)) } }) : [];
      for (const c of open) {
        out.push({
          type: 'change_order', id: c.id, projectId: c.projectId, projectName: pn(c.projectId), title: `${c.number} ${c.title}`,
          detail: c.status === 'internal_review' ? `Internal review · submitted by ${c.submittedBy || '—'}` : 'With the client for approval',
          amount: fromCents(sumCents(items.filter((i) => i.changeOrderId === c.id).map((i) => toCents(i.amount)))),
          since: c.status === 'internal_review' ? c.submittedAt : c.internalApprovedAt || c.updatedAt, canAct: r.approveChangeOrders,
        });
      }
    }
    if (r.viewReimbursables) {
      for (const x of await this.reimbs.find({ where: { status: 'submitted' } })) {
        out.push({
          type: 'reimbursable', id: x.id, projectId: x.projectId, projectName: pn(x.projectId), title: `${x.number} ${x.description}`,
          detail: `Submitted by ${x.submittedBy || '—'}${x.vendor ? ` · ${x.vendor}` : ''}`, amount: fromCents(reimbursableBillC(x)), since: x.createdAt, canAct: r.approveReimbursables,
        });
      }
    }
    if (r.view) {
      for (const x of await this.releases.find({ where: { status: 'requested' } })) {
        out.push({
          type: 'retention_release', id: x.id, projectId: x.projectId, projectName: pn(x.projectId), title: `${x.number} Retention release`,
          detail: `${x.scope === 'project' ? 'Whole project' : x.scope} · requested by ${x.requestedBy || '—'}`, amount: x.amount, since: x.createdAt, canAct: r.releaseRetention,
        });
      }
      const waiting = (await this.invoices.find({ where: { status: 'draft' } })).filter((i) => i.approvalRequestedAt);
      const draftLines = waiting.length ? await this.lines.find({ where: { invoiceId: In(waiting.map((i) => i.id)) } }) : [];
      for (const x of waiting) {
        const total = invoiceTotals(draftLines.filter((l) => l.invoiceId === x.id).map((l) => ({ kind: l.kind, amountC: toCents(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct }))).totalC;
        out.push({
          type: 'invoice', id: x.id, projectId: x.projectId, projectName: pn(x.projectId),
          title: `Draft ${x.kind === 'credit' ? (x.creditType === 'write_off' ? 'write-off' : 'credit note') : x.kind === 'retention' ? 'retention invoice' : 'invoice'}${x.description ? ` — ${x.description}` : ''}`,
          detail: `Sent for approval by ${x.approvalRequestedBy || '—'}`, amount: fromCents(total), since: x.approvalRequestedAt, canAct: r.issueInvoice,
        });
      }
      // Progress reported above what's approved, on projects that bill approved progress only.
      const strict = (await this.pfin.find()).filter((s) => s.requireProgressApproval);
      if (strict.length) {
        const ids = strict.map((s) => s.projectId);
        const [ph, tk, phRows, tkRows] = await Promise.all([
          this.phfin.find({ where: { projectId: In(ids) } }), this.tfin.find({ where: { projectId: In(ids) } }),
          this.phases.find({ where: { projectId: In(ids) } }), this.tasks.find({ where: { projectId: In(ids) } }),
        ]);
        const label = new Map<string, string>([...phRows.map((p) => [p.id, p.name] as [string, string]), ...tkRows.map((t) => [t.id, t.title] as [string, string])]);
        for (const s of strict) {
          if (Number(s.reportedProgress) > Number(s.approvedProgress)) {
            out.push({ type: 'progress', itemKind: 'project', id: String(s.projectId), projectId: s.projectId, projectName: pn(s.projectId), title: 'Whole project', detail: `Reported ${s.reportedProgress}% · approved ${s.approvedProgress}%`, amount: null, since: s.updatedAt, canAct: r.approveProgress });
          }
        }
        for (const [rows, kind, idOf] of [[ph, 'phase', (x: any) => x.phaseId], [tk, 'task', (x: any) => x.taskId]] as const) {
          for (const x of rows as any[]) {
            if (Number(x.reportedProgress) > Number(x.approvedProgress) && label.has(idOf(x))) {
              out.push({ type: 'progress', itemKind: kind, id: idOf(x), projectId: x.projectId, projectName: pn(x.projectId), title: label.get(idOf(x))!, detail: `Reported ${x.reportedProgress}% · approved ${x.approvedProgress}%`, amount: null, since: x.updatedAt, canAct: r.approveProgress });
            }
          }
        }
      }
    }
    return out.sort((a, b) => (a.since || '').localeCompare(b.since || ''));
  }

  /**
   * Every project with money on either side: what clients are billed and pay
   * us, and -- for those who can see costs -- what we've committed to and paid
   * subcontractors and vendors. Outsourced or internal projects with no client
   * contract appear with their paying side only.
   */
  async portfolio(actor: Actor) {
    const r = await this.fin.need(actor, 'view');
    const showCosts = !!this.costs && (r.viewProfitability || r.manageCosts);
    const [settings, name] = await Promise.all([this.pfin.find(), this.projects.find()]);
    const byId = new Map(name.map((p) => [p.id, p]));
    const clientIds = new Set(settings.map((s) => s.projectId));
    const ids = new Set(clientIds);
    if (showCosts) for (const id of await this.costs!.projectsWithCosts()) ids.add(id);
    const labor = showCosts ? await this.costs!.laborAll() : [];
    const rows = [];
    for (const id of ids) {
      const p = byId.get(id);
      if (!p) continue;
      const client = clientIds.has(id) ? toDollars(computeSov((await this.fin.context(id)).input).summary) : {};
      const pay = showCosts ? await this.costs!.payingSide(id, labor) : null;
      rows.push({ projectId: p.id, name: p.name, stage: p.stage, hasClientContract: clientIds.has(id), ...client, ...(pay ? toDollars(pay) : {}) });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** The finance audit trail across projects (or one), newest first. */
  async audit(actor: Actor, q: { projectId?: string; entityType?: string; by?: string; limit?: string }) {
    await this.fin.need(actor, 'view');
    const where: any = {};
    if (q.projectId) where.projectId = Number(q.projectId);
    if (q.entityType) where.entityType = q.entityType;
    const [rows, name] = await Promise.all([this.activity.find({ where }), this.names()]);
    const by = q.by?.trim().toLowerCase();
    return rows.filter((a) => !by || (a.byName || '').toLowerCase().includes(by))
      .sort((a, b) => b.at.localeCompare(a.at)).slice(0, Math.min(Number(q.limit) || 500, 2000))
      .map((a) => ({ ...a, projectName: name.get(a.projectId) || `Project ${a.projectId}` }));
  }
}
