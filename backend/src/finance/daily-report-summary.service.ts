import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeOrderEntity, ProjectEntity, ProjectTaskEntity, RfiEntity } from '../database/entities';
import { FinancialsService } from './financials.service';
import { computeSov } from './finance.calc';

/** The status columns a Daily Report shows for tasks and RFIs (Section I.H / I.I). */
export const ROLLUP_STATUSES = ['To Do', 'Assigned', 'In Progress', 'On Hold', 'Complete', 'Confirmed'] as const;
export type Rollup = Record<(typeof ROLLUP_STATUSES)[number], number>;
const empty = (): Rollup => ({ 'To Do': 0, Assigned: 0, 'In Progress': 0, 'On Hold': 0, Complete: 0, Confirmed: 0 });

const day = (v?: string | null) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');
const plus = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const pct = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

/** Task board status -> the report's column. */
export function taskColumn(t: Pick<ProjectTaskEntity, 'status' | 'completed' | 'assigneeId' | 'assignee'>): keyof Rollup {
  if (t.status === 'Confirmed') return 'Confirmed';
  if (t.completed || t.status === 'Done') return 'Complete';
  if (t.status === 'On hold') return 'On Hold';
  if (t.status === 'In progress') return 'In Progress';
  return t.assigneeId || (t.assignee || '').trim() ? 'Assigned' : 'To Do';
}

/** RFI status -> the report's column. */
export function rfiColumn(status: string): keyof Rollup | null {
  switch (status) {
    case 'draft': return 'To Do';
    case 'open': return 'In Progress';
    case 'answered': return 'Complete';
    case 'closed': return 'Confirmed';
    default: return null; // void
  }
}

/**
 * Section I of a Daily Report: where the project stands, as percentages and
 * counts only -- never dollar amounts, so anyone filing a report can see it.
 */
@Injectable()
export class DailyReportSummaryService {
  constructor(
    private readonly fin: FinancialsService,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(ProjectTaskEntity) private readonly tasks: Repository<ProjectTaskEntity>,
    @InjectRepository(RfiEntity) private readonly rfis: Repository<RfiEntity>,
    @InjectRepository(ChangeOrderEntity) private readonly cos: Repository<ChangeOrderEntity>,
  ) {}

  async summary(projectId: number, onDate?: string) {
    const today = day(onDate) || new Date().toISOString().slice(0, 10);
    const [project, tasks, rfis, cos] = await Promise.all([
      this.projects.findOneBy({ id: projectId }),
      this.tasks.find({ where: { projectId } }),
      this.rfis.find({ where: { projectId } }),
      this.cos.find({ where: { projectId } }),
    ]);

    // I.F -- contract work invoiced against the original contract plus approved change orders.
    let percentInvoiced: number | null = null;
    try {
      const ctx = await this.fin.context(projectId);
      if (ctx.exists) {
        const s = computeSov(ctx.input).summary;
        percentInvoiced = s.revisedContractC > 0 ? pct((s.contractWorkInvoicedC / s.revisedContractC) * 100) : null;
      }
    } catch { /* no financials set up for this project */ }

    // I.G -- days elapsed against the scheduled span, stretched by approved change-order time.
    let start = '', end = '';
    for (const t of tasks) {
      if (t.parentId) continue;
      const s = day(t.startDate) || day(t.dueDate) || day(t.endDate);
      if (!s) continue;
      let e = day(t.endDate) || day(t.dueDate) || (t.durationDays ? plus(s, Math.max(0, t.durationDays - 1)) : s);
      if (e < s) e = s;
      if (!start || s < start) start = s;
      if (!end || e > end) end = e;
    }
    const coDays = cos.filter((c) => c.status === 'approved').reduce((n, c) => n + (Number(c.scheduleImpactDays) || 0), 0);
    if (!start && day(project?.estStart)) start = day(project?.estStart);
    let percentDuration: number | null = null;
    let scheduleEnd: string | null = null;
    if (start && end) {
      scheduleEnd = plus(end, coDays);
      const total = daysBetween(start, scheduleEnd) + 1;
      percentDuration = total > 0 ? pct((Math.max(0, daysBetween(start, today) + 1) / total) * 100) : null;
    }

    // I.H / I.I / I.J -- counts for the whole project.
    const taskCounts = empty();
    for (const t of tasks) taskCounts[taskColumn(t)]++;
    const rfiCounts = empty();
    for (const r of rfis) { const c = rfiColumn(r.status); if (c) rfiCounts[c]++; }
    const coCounts: Record<string, number> = {};
    for (const c of cos) coCounts[c.status] = (coCounts[c.status] || 0) + 1;

    return {
      projectId, asOf: today,
      percentInvoiced, percentDuration, scheduleStart: start || null, scheduleEnd, changeOrderDays: coDays,
      tasks: taskCounts, rfis: rfiCounts, changeOrders: coCounts,
    };
  }
}
