import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceEntity, InvoiceEntity, DealEntity, TaskEntity } from '../database/entities';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(FinanceEntity) private readonly finance: Repository<FinanceEntity>,
    @InjectRepository(InvoiceEntity) private readonly invoices: Repository<InvoiceEntity>,
    @InjectRepository(DealEntity) private readonly deals: Repository<DealEntity>,
    @InjectRepository(TaskEntity) private readonly tasks: Repository<TaskEntity>,
  ) {}

  private finRows(): Promise<any[]> {
    return this.finance.find();
  }
  private internalInvoices(): Promise<any[]> {
    return this.invoices.findBy({ kind: 'internal' });
  }
  private dealRows(): Promise<any[]> {
    return this.deals.find();
  }
  private taskRows(): Promise<any[]> {
    return this.tasks.find();
  }

  async getKpis() {
    const fin = await this.finRows();
    const active = fin.filter((f) => f.phase !== 'Leads');
    const contractValue = active.reduce((t, f) => t + f.base + f.co + f.reimb, 0);
    const internal = await this.internalInvoices();
    const outstandingInvoices = internal.reduce((t, i) => t + (i.amount - i.paid), 0);
    const deals = await this.dealRows();
    const lost = deals.filter((d) => d.stage === 'rejected').length;
    return {
      activeProjects: active.length,
      leadPipeline: { total: deals.length, won: 0, lost, live: deals.length - lost },
      contractValue,
      outstandingInvoices,
    };
  }

  async getBudgetVsSpend() {
    const fin = await this.finRows();
    return fin.map((f) => ({
      name: f.name, exec: f.exec, contractType: f.contract, phase: f.phase,
      base: f.base, co: f.co, reimb: f.reimb,
      baseUsed: f.baseUsed, coUsed: f.coUsed, reimbUsed: f.reimbUsed, timePct: f.timePct,
    }));
  }

  async getRevenueByMonth() {
    const internal = await this.internalInvoices();
    const byMonth = new Map<string, { collected: number; outstanding: number; issued: string }>();
    for (const inv of internal) {
      const m = byMonth.get(inv.month) ?? { collected: 0, outstanding: 0, issued: inv.issued };
      m.collected += inv.paid;
      m.outstanding += inv.amount - inv.paid;
      if (inv.issued < m.issued) m.issued = inv.issued;
      byMonth.set(inv.month, m);
    }
    return [...byMonth.entries()]
      .sort((a, b) => a[1].issued.localeCompare(b[1].issued))
      .map(([month, v]) => ({ month, collected: v.collected, outstanding: v.outstanding }));
  }

  async getLeadFunnel() {
    const deals = await this.dealRows();
    const base = deals.length || 24;
    const steps = [
      { stage: 'Inbound leads', factor: 1 },
      { stage: 'Qualified', factor: 0.67 },
      { stage: 'Face to face held', factor: 0.46 },
      { stage: 'Proposal sent', factor: 0.29 },
      { stage: 'Client approval', factor: 0.17 },
      { stage: 'Contract signed', factor: 0.13 },
    ];
    return steps.map((s) => ({ stage: s.stage, count: Math.round(base * s.factor), conversionPct: Math.round(s.factor * 100) }));
  }

  async getWorkload() {
    const tasks = await this.taskRows();
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (!t.assignedTo) continue;
      counts.set(t.assignedTo, (counts.get(t.assignedTo) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, n]) => ({ name, tasks: n })).sort((a, b) => b.tasks - a.tasks);
  }
}
