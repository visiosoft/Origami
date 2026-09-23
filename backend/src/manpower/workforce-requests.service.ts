import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EmployeeAssignmentEntity, EmployeeEntity, ProjectEntity, TradeEntity,
  WorkforceRequestEntity, type WorkforceRequestLine,
} from '../database/entities';
import { AssignmentsService } from './assignments.service';
import type { ManpowerActor } from './daily-logs.service';
import { isDeployable, isOpen, newId } from './workforce.util';

export interface LineSummary extends WorkforceRequestLine {
  allocated: number;
  available: number;
  shortage: number;
  surplus: number;
}

/** Pure so it can be tested without a database. */
export function summarizeLines(
  request: Pick<WorkforceRequestEntity, 'id' | 'lines'>,
  employees: EmployeeEntity[],
  openRegular: Map<string, unknown>,
  openAssignments: EmployeeAssignmentEntity[],
): LineSummary[] {
  return (request.lines || []).map((line) => {
    const allocated = openAssignments.filter((a) => a.workforceRequestId === request.id && a.requestLineId === line.id).length;
    const available = employees.filter((e) => e.tradeId === line.tradeId && isDeployable(e) && !openRegular.has(e.id)).length;
    return {
      ...line,
      allocated,
      available,
      shortage: Math.max(0, line.quantity - allocated),
      surplus: Math.max(0, allocated - line.quantity),
    };
  });
}

const EDITABLE = ['draft', 'rejected'];

@Injectable()
export class WorkforceRequestsService {
  constructor(
    @InjectRepository(WorkforceRequestEntity) private readonly repo: Repository<WorkforceRequestEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(EmployeeAssignmentEntity) private readonly assignmentsRepo: Repository<EmployeeAssignmentEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    @InjectRepository(TradeEntity) private readonly trades: Repository<TradeEntity>,
    private readonly assignments: AssignmentsService,
  ) {}

  private async context() {
    const [employees, openRegular, linked] = await Promise.all([
      this.employees.find(),
      this.assignments.openRegularByEmployee(),
      this.assignmentsRepo.find({ where: { status: 'active' } }),
    ]);
    return { employees, openRegular, openLinked: linked.filter((a) => a.workforceRequestId && isOpen(a)) };
  }

  private withSummary(r: WorkforceRequestEntity, ctx: Awaited<ReturnType<WorkforceRequestsService['context']>>) {
    const lines = summarizeLines(r, ctx.employees, ctx.openRegular, ctx.openLinked);
    const required = lines.reduce((s, l) => s + l.quantity, 0);
    const allocated = lines.reduce((s, l) => s + Math.min(l.allocated, l.quantity), 0);
    return { ...r, lines, totals: { required, allocated, shortage: required - allocated } };
  }

  async findAll(opts: { projectId?: number; status?: string }) {
    const where: any = {};
    if (opts.projectId != null) where.projectId = opts.projectId;
    if (opts.status) where.status = opts.status;
    const [rows, ctx] = await Promise.all([this.repo.find({ where, order: { requiredDate: 'ASC' } }), this.context()]);
    return rows.map((r) => this.withSummary(r, ctx));
  }

  async findOne(id: string) {
    const [r, ctx] = await Promise.all([this.load(id), this.context()]);
    return this.withSummary(r, ctx);
  }

  private async load(id: string) {
    const r = await this.repo.findOneBy({ id });
    if (!r) throw new NotFoundException(`Workforce request ${id} not found`);
    return r;
  }

  private async cleanLines(lines: any[] | undefined): Promise<WorkforceRequestLine[]> {
    const clean = (lines || []).filter((l) => l && l.tradeId);
    if (!clean.length) throw new BadRequestException('Add at least one line: a trade and how many workers.');
    const trades = await this.trades.find();
    return clean.map((l) => {
      const qty = Number(l.quantity);
      if (!Number.isInteger(qty) || qty < 1) throw new BadRequestException('Each line needs a whole number of workers, at least 1.');
      if (!trades.some((t) => t.id === l.tradeId)) throw new BadRequestException(`Unknown trade ${l.tradeId}.`);
      return { id: l.id || newId('WRL'), tradeId: l.tradeId, designation: l.designation || undefined, quantity: qty };
    });
  }

  async create(dto: any, actor: ManpowerActor) {
    if (!(await this.projects.findOneBy({ id: Number(dto.projectId) }))) throw new BadRequestException('Pick a project.');
    if (!dto.requiredDate) throw new BadRequestException('When are the workers needed?');
    const now = new Date().toISOString();
    const r = this.repo.create({
      id: newId('WR'), projectId: Number(dto.projectId), workArea: dto.workArea, requiredDate: dto.requiredDate,
      durationDays: dto.durationDays ?? null, notes: dto.notes, lines: await this.cleanLines(dto.lines),
      status: dto.submit ? 'submitted' : 'draft', submittedAt: dto.submit ? now : undefined,
      requestedById: actor.id, requestedByName: actor.name, createdAt: now, updatedAt: now,
    } as Partial<WorkforceRequestEntity>);
    return this.findOne((await this.repo.save(r)).id);
  }

  async update(id: string, dto: any) {
    const r = await this.load(id);
    if (!EDITABLE.includes(r.status)) throw new BadRequestException(`A ${r.status} request can no longer be edited.`);
    if (dto.projectId != null) {
      if (!(await this.projects.findOneBy({ id: Number(dto.projectId) }))) throw new BadRequestException('Pick a project.');
      r.projectId = Number(dto.projectId);
    }
    for (const k of ['workArea', 'requiredDate', 'durationDays', 'notes'] as const) {
      if (dto[k] !== undefined) (r as any)[k] = dto[k];
    }
    if (dto.lines !== undefined) r.lines = await this.cleanLines(dto.lines);
    r.status = 'draft';
    r.updatedAt = new Date().toISOString();
    await this.repo.save(r);
    return this.findOne(id);
  }

  private async transition(id: string, from: string[], to: string, extra: Partial<WorkforceRequestEntity> = {}) {
    const r = await this.load(id);
    if (!from.includes(r.status)) throw new BadRequestException(`Cannot move a ${r.status} request to ${to}.`);
    Object.assign(r, extra, { status: to, updatedAt: new Date().toISOString() });
    await this.repo.save(r);
    return this.findOne(id);
  }

  submit(id: string) {
    return this.transition(id, EDITABLE, 'submitted', { submittedAt: new Date().toISOString(), decisionNote: undefined });
  }

  async approve(id: string, note: string | undefined, actor: ManpowerActor) {
    const r = await this.load(id);
    if (actor.id && actor.id === r.requestedById) throw new ForbiddenException("You can't approve your own request.");
    return this.transition(id, ['submitted'], 'approved', { decidedByName: actor.name, decidedAt: new Date().toISOString(), decisionNote: note || '' });
  }

  async reject(id: string, note: string | undefined, actor: ManpowerActor) {
    const r = await this.load(id);
    if (actor.id && actor.id === r.requestedById) throw new ForbiddenException("You can't reject your own request.");
    return this.transition(id, ['submitted'], 'rejected', { decidedByName: actor.name, decidedAt: new Date().toISOString(), decisionNote: note || '' });
  }

  cancel(id: string, actor: ManpowerActor) {
    return this.transition(id, ['draft', 'submitted', 'approved', 'rejected'], 'cancelled', { decidedByName: actor.name, decidedAt: new Date().toISOString() });
  }

  fulfill(id: string, actor: ManpowerActor) {
    return this.transition(id, ['approved'], 'fulfilled', { decidedByName: actor.name, decidedAt: new Date().toISOString() });
  }

  /** Deploy workers against one line of an approved request; closes the request once every line is covered. */
  async allocate(id: string, dto: { lineId: string; employeeIds: string[]; startDate?: string; workArea?: string }, actor: ManpowerActor) {
    const r = await this.load(id);
    if (r.status !== 'approved') throw new BadRequestException('Only an approved request can be allocated.');
    const line = (r.lines || []).find((l) => l.id === dto.lineId);
    if (!line) throw new BadRequestException('That line is not on this request.');
    await this.assignments.assign({
      employeeIds: dto.employeeIds, projectId: r.projectId, workArea: dto.workArea ?? r.workArea,
      startDate: dto.startDate || (r.requiredDate > new Date().toISOString().slice(0, 10) ? r.requiredDate : undefined),
      designation: line.designation, assignmentType: 'regular', workforceRequestId: r.id, requestLineId: line.id,
    }, actor);
    const updated = await this.findOne(id);
    if (updated.lines.every((l) => l.allocated >= l.quantity)) {
      return this.transition(id, ['approved'], 'fulfilled', { decidedByName: actor.name, decidedAt: new Date().toISOString() });
    }
    return updated;
  }

  async remove(id: string) {
    const r = await this.load(id);
    if (!['draft', 'cancelled', 'rejected'].includes(r.status)) throw new BadRequestException('Cancel the request instead -- it has been acted on.');
    await this.repo.remove(r);
    return { id, deleted: true };
  }
}
