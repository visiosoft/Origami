import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EmployeeEntity, ShiftAssignmentEntity, ShiftTemplateEntity } from '../database/entities';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { addDays } from './calendar.util';
import { LEFT_STATUSES, lifecycleStatus, newId, todayISO } from './workforce.util';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['day', 'night', 'twelve_hour', 'weekend', 'emergency'];

const DEFAULT_SHIFTS: Omit<ShiftTemplateEntity, 'order'>[] = [
  { id: 'SH-DAY', name: 'Day shift', code: 'D', kind: 'day', startTime: '08:00', endTime: '17:00', allowancePerDay: 0, color: '#E8B64C', active: true },
  { id: 'SH-NIGHT', name: 'Night shift', code: 'N', kind: 'night', startTime: '20:00', endTime: '05:00', allowancePerDay: 0, color: '#3C5C8A', active: true },
  { id: 'SH-12D', name: '12-hour day', code: 'D12', kind: 'twelve_hour', startTime: '07:00', endTime: '19:00', allowancePerDay: 0, color: '#D08A2E', active: true },
  { id: 'SH-12N', name: '12-hour night', code: 'N12', kind: 'twelve_hour', startTime: '19:00', endTime: '07:00', allowancePerDay: 0, color: '#26406B', active: true },
  { id: 'SH-WKND', name: 'Weekend shift', code: 'W', kind: 'weekend', startTime: '08:00', endTime: '14:00', allowancePerDay: 0, color: '#1F8A72', active: true },
  { id: 'SH-EMRG', name: 'Emergency call-out', code: 'E', kind: 'emergency', startTime: '00:00', endTime: '23:59', allowancePerDay: 0, color: '#8E2E0A', active: true },
];

@Injectable()
export class ShiftsService implements OnApplicationBootstrap {
  private readonly log = new Logger('ShiftsService');

  constructor(
    @InjectRepository(ShiftTemplateEntity) private readonly templates: Repository<ShiftTemplateEntity>,
    @InjectRepository(ShiftAssignmentEntity) private readonly assignments: Repository<ShiftAssignmentEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    private readonly access: ManpowerAccess,
  ) {}

  async onApplicationBootstrap() {
    try {
      if ((await this.templates.count()) === 0) {
        await this.templates.save(DEFAULT_SHIFTS.map((t, i) => ({ ...t, order: i })) as ShiftTemplateEntity[]);
        this.log.log(`Seeded ${DEFAULT_SHIFTS.length} shift templates`);
      }
    } catch (err) {
      this.log.error('Shift seed failed: ' + (err as Error).message);
    }
  }

  listTemplates() {
    return this.templates.find({ order: { order: 'ASC' } });
  }

  private check(t: Partial<ShiftTemplateEntity>) {
    if (t.kind && !KINDS.includes(t.kind)) throw new BadRequestException('Unknown shift kind.');
    if (t.startTime && !TIME.test(t.startTime)) throw new BadRequestException('Start time must be HH:MM.');
    if (t.endTime && !TIME.test(t.endTime)) throw new BadRequestException('End time must be HH:MM.');
    if (t.allowancePerDay != null && !(Number(t.allowancePerDay) >= 0)) throw new BadRequestException('The allowance cannot be negative.');
  }

  async createTemplate(dto: Partial<ShiftTemplateEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change shift templates');
    if (!dto.name?.trim()) throw new BadRequestException('Name the shift.');
    const row = { kind: 'day', startTime: '08:00', endTime: '17:00', allowancePerDay: 0, active: true, order: await this.templates.count(), ...dto, name: dto.name.trim() };
    this.check(row);
    return this.templates.save(this.templates.create({ ...row, id: newId('SH') }));
  }

  async updateTemplate(id: string, dto: Partial<ShiftTemplateEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change shift templates');
    const t = await this.templates.findOneBy({ id });
    if (!t) throw new NotFoundException('Shift not found');
    this.check(dto);
    Object.assign(t, dto, { id });
    return this.templates.save(t);
  }

  async removeTemplate(id: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'change shift templates');
    const used = (await this.assignments.find()).some((a) => a.templateIds.includes(id));
    if (used) throw new BadRequestException('Someone has been rostered on this shift -- make it inactive instead.');
    const t = await this.templates.findOneBy({ id });
    if (t) await this.templates.remove(t);
    return { id, deleted: true };
  }

  async findAssignments(opts: { employeeId?: string; from?: string; to?: string }) {
    const where: any = {};
    if (opts.employeeId) where.employeeId = opts.employeeId;
    const rows = await this.assignments.find({ where, order: { startDate: 'DESC' } });
    return rows.filter((a) => (!opts.to || a.startDate <= opts.to) && (!opts.from || !a.endDate || a.endDate >= opts.from));
  }

  /**
   * Put one or more people on a shift (or a rotation) from a date. Whatever
   * they were on ends the day before, so history reads as one unbroken line;
   * a previous assignment that hadn't started yet is simply replaced.
   */
  async assign(dto: { employeeIds: string[]; templateIds: string[]; rotateEveryDays?: number; startDate: string; endDate?: string; notes?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'roster shifts');
    const ids = Array.from(new Set(dto.employeeIds || []));
    if (!ids.length) throw new BadRequestException('Pick at least one person.');
    if (!ISO.test(dto.startDate || '')) throw new BadRequestException('Give the start date.');
    if (dto.endDate && dto.endDate < dto.startDate) throw new BadRequestException('The end date is before the start date.');
    const templateIds = (dto.templateIds || []).filter(Boolean);
    if (!templateIds.length) throw new BadRequestException('Pick a shift.');
    const found = await this.templates.findBy({ id: In(templateIds) });
    if (found.length !== new Set(templateIds).size) throw new BadRequestException('Unknown shift in the selection.');
    const every = templateIds.length > 1 ? Number(dto.rotateEveryDays) : null;
    if (templateIds.length > 1 && (!Number.isInteger(every) || every! < 1 || every! > 90)) throw new BadRequestException('Say how many days each shift in the rotation lasts (1-90).');

    const emps = await this.employees.findBy({ id: In(ids) });
    const gone = emps.filter((e) => LEFT_STATUSES.includes(lifecycleStatus(e)));
    if (emps.length !== ids.length) throw new BadRequestException('Some of those people no longer exist.');
    if (gone.length) throw new BadRequestException(`${gone.map((e) => e.name).join(', ')} no longer work here.`);

    return this.assignments.manager.transaction(async (m) => {
      const repo = m.getRepository(ShiftAssignmentEntity);
      const open = (await repo.find({ where: { employeeId: In(ids) } })).filter((a) => !a.endDate || a.endDate >= dto.startDate);
      const replaced = open.filter((a) => a.startDate >= dto.startDate);
      const ended = open.filter((a) => a.startDate < dto.startDate);
      if (replaced.length) await repo.remove(replaced);
      for (const a of ended) Object.assign(a, { endDate: addDays(dto.startDate, -1), endedByName: actor.name });
      if (ended.length) await repo.save(ended);
      const now = new Date().toISOString();
      const rows = ids.map((employeeId) => repo.create({
        id: newId('SA'), employeeId, templateIds, rotateEveryDays: every ?? undefined, startDate: dto.startDate,
        endDate: dto.endDate || undefined, notes: dto.notes, createdByName: actor.name, createdAt: now,
      }));
      return repo.save(rows);
    });
  }

  async end(id: string, endDate: string | undefined, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'roster shifts');
    const a = await this.assignments.findOneBy({ id });
    if (!a) throw new NotFoundException('Shift assignment not found');
    const date = endDate || todayISO();
    if (date < a.startDate) throw new BadRequestException('That is before the assignment started -- delete it instead of ending it.');
    if (a.endDate && a.endDate < date) throw new BadRequestException('This assignment has already ended.');
    Object.assign(a, { endDate: date, endedByName: actor.name });
    return this.assignments.save(a);
  }

  async remove(id: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'roster shifts');
    const a = await this.assignments.findOneBy({ id });
    if (!a) throw new NotFoundException('Shift assignment not found');
    if (a.startDate <= todayISO()) throw new BadRequestException('This shift has already started -- end it instead so the history stays.');
    await this.assignments.remove(a);
    return { id, deleted: true };
  }
}
