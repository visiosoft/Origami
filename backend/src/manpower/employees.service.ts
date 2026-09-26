import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeAssignmentEntity, EmployeeEntity, SubcontractorTradeEntity } from '../database/entities';
import { AttachmentsService, type UploadActor } from '../google/attachments.service';
import { StaffDirectorySync } from './staff-directory.sync';
import { nextWorkerId } from './workforce.util';

export { nextWorkerId };

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(EmployeeEntity) private readonly repo: Repository<EmployeeEntity>,
    @InjectRepository(SubcontractorTradeEntity) private readonly trades: Repository<SubcontractorTradeEntity>,
    private readonly attachments: AttachmentsService,
    @InjectRepository(EmployeeAssignmentEntity) private readonly assignments: Repository<EmployeeAssignmentEntity>,
    private readonly staff?: StaffDirectorySync,
  ) {}

  /** Keep the People entry in step; never let that fail the employee save itself. */
  private async toPeople(e: EmployeeEntity) {
    try { await this.staff?.syncEmployee(e); } catch { /* the startup backfill catches up */ }
    return e;
  }

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const employee = await this.repo.findOneBy({ id });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  /** Keeps the free-text `trade` in step with the picked trade, the way assignee/assigneeId pair up. */
  private async withTradeName(dto: any) {
    if (!dto.tradeId) return dto;
    const trade = await this.trades.findOneBy({ id: dto.tradeId });
    return trade ? { ...dto, trade: trade.name } : dto;
  }

  async create(dto: any) {
    if (!dto.name?.trim()) throw new BadRequestException('A name is required.');
    const all = await this.repo.find({ select: { workerId: true } as any });
    const now = new Date().toISOString();
    const employee = {
      status: 'active', employmentStatus: 'active', createdAt: now, updatedAt: now,
      ...(await this.withTradeName(dto)),
      workerId: dto.workerId?.trim() || nextWorkerId(all.map((e) => e.workerId), dto.hireDate),
      id: dto.id || 'EMP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    };
    return this.toPeople(await this.repo.save(this.repo.create(employee as Partial<EmployeeEntity>)));
  }

  async update(id: string, dto: any) {
    const employee = await this.findOne(id);
    const { photo: _ignored, ...rest } = await this.withTradeName(dto);
    if (rest.payComponents) {
      rest.payComponents = (rest.payComponents as any[]).map((c) => {
        const value = Number(c?.value);
        if (!c?.componentId || !Number.isFinite(value) || value < 0) throw new BadRequestException('Each pay component needs a value of 0 or more.');
        return { componentId: String(c.componentId), value };
      });
    }
    if (rest.overtimeRate != null && !(Number(rest.overtimeRate) > 0)) throw new BadRequestException('An overtime rate must be above 0 -- clear it to use their normal hourly rate.');
    if (rest.payRate != null && !(Number(rest.payRate) >= 0)) throw new BadRequestException('The pay rate cannot be negative.');
    Object.assign(employee, rest, { id, updatedAt: new Date().toISOString() });
    // The legacy active/inactive flag follows the richer lifecycle status.
    if (rest.employmentStatus) employee.status = rest.employmentStatus === 'active' ? 'active' : 'inactive';
    return this.toPeople(await this.repo.save(employee));
  }

  async remove(id: string) {
    const employee = await this.repo.findOneBy({ id });
    if (employee && (await this.assignments.count({ where: { employeeId: id } }))) {
      throw new BadRequestException(`${employee.name} has deployment history -- set their status to Resigned, Terminated or Demobilized instead of deleting.`);
    }
    if (employee) {
      await this.attachments.discard(employee.photo ?? undefined);
      await this.repo.remove(employee);
      await this.staff?.removeEmployee(id);
    }
    return { id, deleted: true };
  }

  async setPhoto(id: string, files: any[], actor: UploadActor) {
    const employee = await this.findOne(id);
    const image = files?.[0];
    if (!image?.mimetype?.startsWith('image/')) throw new BadRequestException('The photo must be an image.');
    const [uploaded] = await this.attachments.upload([image], 'Employee Photos', actor);
    await this.attachments.discard(employee.photo ?? undefined);
    employee.photo = uploaded;
    employee.updatedAt = new Date().toISOString();
    return this.repo.save(employee);
  }

  async photo(id: string) {
    const employee = await this.findOne(id);
    if (!employee.photo) throw new NotFoundException('No photo on file');
    return employee.photo;
  }
}
