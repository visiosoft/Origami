import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeAdvanceEntity, EmployeeEntity } from '../database/entities';
import { FINANCE_MODULE, HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { ADVANCE_LABEL, round2 } from './payroll.calc';
import { newId, todayISO } from './workforce.util';

/** Each approval step, the status it acts on, and the permission it needs. */
export const APPROVAL_CHAIN = [
  { stage: 'manager', status: 'pending_manager', next: 'pending_hr', module: HR_MODULE, label: 'Manager' },
  { stage: 'hr', status: 'pending_hr', next: 'pending_finance', module: HR_MODULE, label: 'HR' },
  { stage: 'finance', status: 'pending_finance', next: 'approved', module: FINANCE_MODULE, label: 'Finance' },
] as const;

const PENDING = APPROVAL_CHAIN.map((s) => s.status as string);

export const remainingOf = (a: Pick<EmployeeAdvanceEntity, 'amount' | 'recovered'>) => round2((Number(a.amount) || 0) - (Number(a.recovered) || 0));

/** First day of the month after `date` -- the default start of recovery. */
const nextMonthStart = (date: string) => {
  const d = new Date(date + 'T00:00:00Z');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
};

@Injectable()
export class AdvancesService {
  constructor(
    @InjectRepository(EmployeeAdvanceEntity) private readonly repo: Repository<EmployeeAdvanceEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    private readonly access: ManpowerAccess,
  ) {}

  private hydrate(a: EmployeeAdvanceEntity) {
    const remaining = remainingOf(a);
    const step = APPROVAL_CHAIN.find((s) => s.status === a.status);
    return { ...a, remaining, awaiting: step?.label, nextInstallment: a.status === 'disbursed' ? round2(Math.min(a.installmentAmount, remaining)) : 0 };
  }

  async findAll(opts: { employeeId?: string; status?: string }) {
    const where: any = {};
    if (opts.employeeId) where.employeeId = opts.employeeId;
    if (opts.status) where.status = opts.status;
    const rows = await this.repo.find({ where, order: { requestDate: 'DESC' } });
    return rows.map((a) => this.hydrate(a));
  }

  private async load(id: string) {
    const a = await this.repo.findOneBy({ id });
    if (!a) throw new NotFoundException('Advance / loan not found');
    return a;
  }

  async create(dto: { employeeId: string; type: string; amount: number; installments?: number; reason?: string; requestDate?: string; deductionStart?: string }, actor: Actor) {
    if (!ADVANCE_LABEL[dto.type]) throw new BadRequestException('Unknown advance / loan type.');
    const emp = await this.employees.findOneBy({ id: dto.employeeId });
    if (!emp) throw new BadRequestException('Pick the employee.');
    if (emp.contractorId) throw new BadRequestException(`${emp.name} is a contractor's worker -- advances go through their contractor.`);
    const amount = round2(Number(dto.amount));
    if (!(amount > 0)) throw new BadRequestException('The amount must be above 0.');
    const installments = dto.installments == null ? 1 : Number(dto.installments);
    if (!Number.isInteger(installments) || installments < 1 || installments > 120) throw new BadRequestException('Instalments must be a whole number from 1 to 120.');
    const requestDate = dto.requestDate || todayISO();
    const now = new Date().toISOString();
    const a = this.repo.create({
      id: newId('ADV'), employeeId: emp.id, type: dto.type, amount, requestDate, reason: dto.reason,
      installments, installmentAmount: round2(Math.ceil((amount / installments) * 100) / 100),
      deductionStart: dto.deductionStart || nextMonthStart(requestDate),
      status: 'pending_manager', approvals: [], repayments: [], recovered: 0,
      createdByName: actor.name, createdById: actor.id, createdAt: now, updatedAt: now,
    });
    return this.hydrate(await this.repo.save(a));
  }

  /**
   * Move one step up the chain. Separation of duties: the requester, the
   * employee themselves, and anyone who approved an earlier step can't
   * approve this one.
   */
  async decide(id: string, decision: 'approved' | 'rejected', note: string | undefined, actor: Actor) {
    const a = await this.load(id);
    const step = APPROVAL_CHAIN.find((s) => s.status === a.status);
    if (!step) throw new BadRequestException(`This request is ${a.status.replace('_', ' ')} -- there is nothing to ${decision === 'approved' ? 'approve' : 'reject'}.`);
    await this.access.require(actor, step.module, `${decision === 'approved' ? 'approve' : 'reject'} at the ${step.label} step`);
    if (actor.id && actor.id === a.createdById) throw new ForbiddenException('You raised this request -- someone else has to decide it.');
    const emp = await this.employees.findOneBy({ id: a.employeeId });
    if (actor.id && emp?.userId && emp.userId === actor.id) throw new ForbiddenException("You can't decide your own advance or loan.");
    if (decision === 'approved' && actor.id && a.approvals.some((x) => x.byId === actor.id)) {
      throw new ForbiddenException('You already approved an earlier step -- a different person has to approve this one.');
    }
    a.approvals = [...(a.approvals || []), { stage: step.stage, decision, byName: actor.name, byId: actor.id, at: new Date().toISOString(), note: note || undefined }];
    a.status = decision === 'approved' ? step.next : 'rejected';
    a.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(a));
  }

  async cancel(id: string, actor: Actor) {
    const a = await this.load(id);
    if (![...PENDING, 'approved'].includes(a.status)) throw new BadRequestException('Only a request that has not been paid out can be cancelled.');
    const own = !!actor.id && actor.id === a.createdById;
    if (!own && !(await this.access.can(actor, HR_MODULE))) throw new ForbiddenException('Only the requester or HR can cancel this.');
    a.status = 'cancelled';
    a.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(a));
  }

  /** Finance pays the money out; recovery through payroll starts from here. */
  async disburse(id: string, dto: { date?: string; method?: string; ref?: string }, actor: Actor) {
    const a = await this.load(id);
    if (a.status !== 'approved') throw new BadRequestException('Only a fully approved request can be paid out.');
    await this.access.require(actor, FINANCE_MODULE, 'pay out advances and loans');
    const date = dto.date || todayISO();
    Object.assign(a, {
      status: 'disbursed', disbursedAt: date, disbursedByName: actor.name, paymentMethod: dto.method || 'bank_transfer', paymentRef: dto.ref,
      deductionStart: a.deductionStart < date ? nextMonthStart(date) : a.deductionStart, updatedAt: new Date().toISOString(),
    });
    return this.hydrate(await this.repo.save(a));
  }

  /** A repayment made outside payroll (cash back, final settlement). */
  async repay(id: string, dto: { amount: number; date?: string; note?: string }, actor: Actor) {
    const a = await this.load(id);
    if (a.status !== 'disbursed') throw new BadRequestException('Only an advance that has been paid out and is still owed can take a repayment.');
    await this.access.require(actor, FINANCE_MODULE, 'record repayments');
    const amount = round2(Number(dto.amount));
    if (!(amount > 0)) throw new BadRequestException('The repayment must be above 0.');
    if (amount > remainingOf(a) + 0.005) throw new BadRequestException(`Only ${remainingOf(a)} is still owed.`);
    a.repayments = [...(a.repayments || []), { id: newId('RP'), date: dto.date || todayISO(), amount, method: 'manual', byName: actor.name, note: dto.note }];
    a.recovered = round2((a.recovered || 0) + amount);
    if (remainingOf(a) <= 0.005) a.status = 'settled';
    a.updatedAt = new Date().toISOString();
    return this.hydrate(await this.repo.save(a));
  }
}
