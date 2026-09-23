import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { EmployeeAssignmentEntity, EmployeeEntity, ProjectEntity } from '../database/entities';
import type { ManpowerActor } from './daily-logs.service';
import { isDeployable, isOpen, newId, todayISO } from './workforce.util';

export interface AssignInput {
  employeeIds: string[];
  projectId: number;
  workArea?: string;
  startDate?: string;
  endDate?: string;
  assignmentType?: string;
  designation?: string;
  notes?: string;
  workforceRequestId?: string;
  requestLineId?: string;
}

export interface TransferInput {
  projectId: number;
  workArea?: string;
  startDate?: string;
  designation?: string;
  notes?: string;
}

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(EmployeeAssignmentEntity) private readonly repo: Repository<EmployeeAssignmentEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
  ) {}

  private hydrate(a: EmployeeAssignmentEntity) {
    return { ...a, current: isOpen(a) };
  }

  async findAll(opts: { employeeId?: string; projectId?: number; status?: string; workforceRequestId?: string }) {
    const where: any = {};
    if (opts.employeeId) where.employeeId = opts.employeeId;
    if (opts.projectId != null) where.projectId = opts.projectId;
    if (opts.workforceRequestId) where.workforceRequestId = opts.workforceRequestId;
    const rows = await this.repo.find({ where, order: { startDate: 'DESC' } });
    const shown = opts.status === 'current' ? rows.filter((a) => isOpen(a))
      : opts.status === 'ended' ? rows.filter((a) => !isOpen(a))
        : rows;
    return shown.map((a) => this.hydrate(a));
  }

  /** employeeId -> their open regular assignment. Temporary cover doesn't make someone unavailable. */
  async openRegularByEmployee(): Promise<Map<string, EmployeeAssignmentEntity>> {
    const rows = await this.repo.find({ where: { status: 'active', assignmentType: 'regular' } });
    return new Map(rows.filter((a) => isOpen(a)).map((a) => [a.employeeId, a]));
  }

  private async requireProject(projectId: number) {
    const project = await this.projects.findOneBy({ id: Number(projectId) });
    if (!project) throw new BadRequestException(`Project ${projectId} does not exist.`);
    return project;
  }

  private checkDates(start: string, end?: string) {
    if (end && end < start) throw new BadRequestException('The end date is before the start date.');
  }

  /**
   * Deploy one or more workers onto a project. All-or-nothing: if any of them
   * can't go (left the company, already deployed elsewhere) nothing is saved
   * and the error names every one, so the picker can be corrected in one go.
   */
  async assign(dto: AssignInput, actor: ManpowerActor) {
    const ids = Array.from(new Set(dto.employeeIds || []));
    if (!ids.length) throw new BadRequestException('Pick at least one worker.');
    await this.requireProject(dto.projectId);
    const startDate = dto.startDate || todayISO();
    this.checkDates(startDate, dto.endDate);
    const type = dto.assignmentType === 'temporary' ? 'temporary' : 'regular';
    if (type === 'temporary' && !dto.endDate) throw new BadRequestException('A temporary assignment needs an end date.');

    return this.repo.manager.transaction(async (m) => {
      const emps = await m.getRepository(EmployeeEntity).findBy({ id: In(ids) });
      const byId = new Map(emps.map((e) => [e.id, e]));
      const open = type === 'regular'
        ? (await m.getRepository(EmployeeAssignmentEntity).find({ where: { employeeId: In(ids), status: 'active', assignmentType: 'regular' } })).filter((a) => isOpen(a, startDate))
        : [];
      const problems: string[] = [];
      for (const id of ids) {
        const e = byId.get(id);
        if (!e) problems.push(`${id} not found`);
        else if (!isDeployable(e)) problems.push(`${e.name} is not active`);
        else if (open.some((a) => a.employeeId === id)) problems.push(`${e.name} is already deployed -- transfer them instead`);
      }
      if (problems.length) throw new BadRequestException(problems.join('; '));

      const now = new Date().toISOString();
      const rows = ids.map((id) => {
        const e = byId.get(id)!;
        return m.getRepository(EmployeeAssignmentEntity).create({
          id: newId('ASG'), employeeId: id, projectId: Number(dto.projectId), workArea: dto.workArea,
          tradeId: e.tradeId, designation: dto.designation || e.designation || e.jobTitle,
          assignmentType: type, startDate, endDate: dto.endDate, status: 'active',
          workforceRequestId: dto.workforceRequestId, requestLineId: dto.requestLineId,
          notes: dto.notes, createdByName: actor.name, createdAt: now, updatedAt: now,
        });
      });
      const saved = await m.getRepository(EmployeeAssignmentEntity).save(rows);
      return saved.map((a) => this.hydrate(a));
    });
  }

  private async requireOpen(m: EntityManager, id: string) {
    const a = await m.getRepository(EmployeeAssignmentEntity).findOneBy({ id });
    if (!a) throw new NotFoundException(`Assignment ${id} not found`);
    if (!isOpen(a)) throw new BadRequestException('This assignment has already ended.');
    return a;
  }

  /** Move a worker to another project or work area: the old stint closes on the day the new one starts. */
  async transfer(id: string, dto: TransferInput, actor: ManpowerActor) {
    await this.requireProject(dto.projectId);
    const effective = dto.startDate || todayISO();
    return this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(EmployeeAssignmentEntity);
      const from = await this.requireOpen(m, id);
      if (effective < from.startDate) throw new BadRequestException('A transfer cannot take effect before the current assignment started.');
      if (Number(dto.projectId) === from.projectId && (dto.workArea || '') === (from.workArea || '')) {
        throw new BadRequestException('That is the same project and work area they are already on.');
      }
      const now = new Date().toISOString();
      Object.assign(from, { status: 'ended', endDate: effective, endReason: 'transfer', endedByName: actor.name, updatedAt: now });
      await repo.save(from);
      const to = repo.create({
        id: newId('ASG'), employeeId: from.employeeId, projectId: Number(dto.projectId), workArea: dto.workArea,
        tradeId: from.tradeId, designation: dto.designation || from.designation, assignmentType: from.assignmentType,
        startDate: effective, status: 'active', transferredFromId: from.id, notes: dto.notes,
        createdByName: actor.name, createdAt: now, updatedAt: now,
      });
      return this.hydrate(await repo.save(to));
    });
  }

  /** End a stint normally -- the worker goes back to the available pool. */
  async release(id: string, dto: { endDate?: string; notes?: string }, actor: ManpowerActor) {
    return this.repo.manager.transaction(async (m) => {
      const a = await this.requireOpen(m, id);
      const endDate = dto.endDate || todayISO();
      this.checkDates(a.startDate, endDate);
      Object.assign(a, {
        status: 'ended', endDate, endReason: 'completed', endedByName: actor.name, updatedAt: new Date().toISOString(),
        notes: dto.notes ? [a.notes, dto.notes].filter(Boolean).join('\n') : a.notes,
      });
      return this.hydrate(await m.getRepository(EmployeeAssignmentEntity).save(a));
    });
  }

  /** Stand a worker down from site entirely: every open stint ends and their status becomes Demobilized. */
  async demobilize(employeeId: string, dto: { date?: string; notes?: string }, actor: ManpowerActor) {
    const date = dto.date || todayISO();
    return this.repo.manager.transaction(async (m) => {
      const emp = await m.getRepository(EmployeeEntity).findOneBy({ id: employeeId });
      if (!emp) throw new NotFoundException(`Employee ${employeeId} not found`);
      const repo = m.getRepository(EmployeeAssignmentEntity);
      const open = (await repo.find({ where: { employeeId, status: 'active' } })).filter((a) => isOpen(a, date));
      const now = new Date().toISOString();
      for (const a of open) {
        Object.assign(a, { status: 'ended', endDate: date < a.startDate ? a.startDate : date, endReason: 'demobilized', endedByName: actor.name, updatedAt: now });
      }
      if (open.length) await repo.save(open);
      Object.assign(emp, { employmentStatus: 'demobilized', status: 'inactive', updatedAt: now });
      await m.getRepository(EmployeeEntity).save(emp);
      return { employeeId, ended: open.length };
    });
  }

  /** Small corrections on an open stint (area, designation, planned end, notes). Moving projects is a transfer. */
  async update(id: string, dto: { workArea?: string; designation?: string; endDate?: string; notes?: string }) {
    return this.repo.manager.transaction(async (m) => {
      const a = await this.requireOpen(m, id);
      if (dto.endDate !== undefined) this.checkDates(a.startDate, dto.endDate || undefined);
      for (const k of ['workArea', 'designation', 'endDate', 'notes'] as const) {
        if (dto[k] !== undefined) (a as any)[k] = dto[k] || null;
      }
      if (a.assignmentType === 'temporary' && !a.endDate) throw new BadRequestException('A temporary assignment needs an end date.');
      a.updatedAt = new Date().toISOString();
      return this.hydrate(await m.getRepository(EmployeeAssignmentEntity).save(a));
    });
  }
}
