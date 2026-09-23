import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccommodationIssueEntity, AccommodationUnitEntity, BedAllocationEntity, EmployeeEntity } from '../database/entities';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { addDays } from './calendar.util';
import { LEFT_STATUSES, lifecycleStatus, newId, todayISO } from './workforce.util';

export const LEVELS = ['camp', 'building', 'floor', 'room', 'bed'] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A child must sit exactly one level below its parent; camps have no parent. */
export function validParent(level: string, parentLevel: string | null) {
  const i = LEVELS.indexOf(level as any);
  if (i < 0) return false;
  if (i === 0) return parentLevel === null;
  // Floors are optional: a room can sit straight in a building.
  if (level === 'room') return parentLevel === 'floor' || parentLevel === 'building';
  return parentLevel === LEVELS[i - 1];
}

@Injectable()
export class AccommodationService {
  constructor(
    @InjectRepository(AccommodationUnitEntity) private readonly units: Repository<AccommodationUnitEntity>,
    @InjectRepository(BedAllocationEntity) private readonly allocations: Repository<BedAllocationEntity>,
    @InjectRepository(AccommodationIssueEntity) private readonly issues: Repository<AccommodationIssueEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    private readonly access: ManpowerAccess,
  ) {}

  /** The whole estate and who is in each bed today; the client builds the tree and occupancy from it. */
  async overview() {
    const today = todayISO();
    const [units, allocs, issues] = await Promise.all([this.units.find(), this.allocations.find(), this.issues.find()]);
    // Current and upcoming stays: not yet checked out as of today.
    const current = allocs.filter((a) => !a.checkOut || a.checkOut >= today);
    return { units, allocations: current, issues: issues.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)) };
  }

  async history(employeeId: string) {
    const allocs = (await this.allocations.find({ where: { employeeId } })).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    const units = await this.units.find();
    const byId = new Map(units.map((u) => [u.id, u]));
    const path = (id: string) => { const out: string[] = []; let u = byId.get(id); while (u) { out.unshift(u.name); u = u.parentId ? byId.get(u.parentId) : undefined; } return out.join(' › '); };
    return allocs.map((a) => ({ ...a, location: path(a.bedId) }));
  }

  async createUnit(dto: { parentId?: string; level: string; name?: string; count?: number }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'manage accommodation');
    const parent = dto.parentId ? await this.units.findOneBy({ id: dto.parentId }) : null;
    if (dto.parentId && !parent) throw new BadRequestException('Parent not found.');
    if (!validParent(dto.level, parent?.level ?? null)) throw new BadRequestException(`A ${dto.level} can't go inside a ${parent?.level ?? 'nothing'}.`);
    const now = new Date().toISOString();
    // Beds are usually added several at a time: "4 beds" -> Bed 1..4 after any existing.
    if (dto.level === 'bed' && dto.count) {
      const n = Number(dto.count);
      if (!Number.isInteger(n) || n < 1 || n > 50) throw new BadRequestException('Add between 1 and 50 beds at a time.');
      const siblings = (await this.units.find({ where: { parentId: parent!.id } })).length;
      return this.units.save(Array.from({ length: n }, (_, i) => this.units.create({ id: newId('AU'), parentId: parent!.id, level: 'bed', name: `Bed ${siblings + i + 1}`, active: true, createdAt: now })));
    }
    if (!dto.name?.trim()) throw new BadRequestException(`Name the ${dto.level}.`);
    return this.units.save(this.units.create({ id: newId('AU'), parentId: parent?.id, level: dto.level, name: dto.name.trim(), active: true, createdAt: now }));
  }

  async updateUnit(id: string, dto: { name?: string; notes?: string; active?: boolean }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'manage accommodation');
    const u = await this.units.findOneBy({ id });
    if (!u) throw new NotFoundException('Not found');
    if (dto.active === false && (await this.occupiedBeds(id)).length) throw new BadRequestException('People are allocated here -- check them out first.');
    if (dto.name !== undefined && !dto.name.trim()) throw new BadRequestException('A name is required.');
    Object.assign(u, { ...dto, name: dto.name?.trim() ?? u.name });
    return this.units.save(u);
  }

  private async descendants(id: string) {
    const all = await this.units.find();
    const out: AccommodationUnitEntity[] = [];
    const walk = (pid: string) => all.filter((u) => u.parentId === pid).forEach((u) => { out.push(u); walk(u.id); });
    walk(id);
    return out;
  }

  private async occupiedBeds(id: string) {
    const beds = [...(await this.descendants(id)), ...(await this.units.findBy({ id }))].filter((u) => u.level === 'bed').map((u) => u.id);
    const today = todayISO();
    return (await this.allocations.find()).filter((a) => beds.includes(a.bedId) && (!a.checkOut || a.checkOut >= today));
  }

  async removeUnit(id: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'manage accommodation');
    const u = await this.units.findOneBy({ id });
    if (!u) return { id, deleted: true };
    const subtree = [u, ...(await this.descendants(id))];
    const beds = subtree.filter((x) => x.level === 'bed').map((x) => x.id);
    if ((await this.allocations.find()).some((a) => beds.includes(a.bedId))) throw new BadRequestException('Beds here have allocation history -- deactivate instead of deleting.');
    await this.units.remove(subtree);
    return { id, deleted: subtree.length };
  }

  /** Put someone in a bed. If they're already in one, that's a move: the old bed is checked out the day before. */
  async allocate(dto: { bedId: string; employeeId: string; checkIn?: string; notes?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'allocate beds');
    const bed = await this.units.findOneBy({ id: dto.bedId });
    if (!bed || bed.level !== 'bed') throw new BadRequestException('Pick a bed.');
    if (!bed.active) throw new BadRequestException('That bed is out of use.');
    const emp = await this.employees.findOneBy({ id: dto.employeeId });
    if (!emp) throw new BadRequestException('Pick the employee.');
    if (LEFT_STATUSES.includes(lifecycleStatus(emp))) throw new BadRequestException(`${emp.name} no longer works here.`);
    const checkIn = dto.checkIn || todayISO();
    if (!ISO.test(checkIn)) throw new BadRequestException('Give the check-in date.');
    return this.allocations.manager.transaction(async (m) => {
      const repo = m.getRepository(BedAllocationEntity);
      const all = await repo.find();
      const inBed = all.find((a) => a.bedId === bed.id && (!a.checkOut || a.checkOut >= checkIn));
      if (inBed) {
        const who = await this.employees.findOneBy({ id: inBed.employeeId });
        throw new BadRequestException(`${bed.name} is taken by ${who?.name || 'someone'} -- check them out first.`);
      }
      const mine = all.filter((a) => a.employeeId === emp.id && (!a.checkOut || a.checkOut >= checkIn));
      for (const a of mine) {
        if (a.checkIn >= checkIn) throw new BadRequestException(`${emp.name} already has a bed from ${a.checkIn}.`);
        a.checkOut = addDays(checkIn, -1);
      }
      if (mine.length) await repo.save(mine);
      return repo.save(repo.create({ id: newId('BA'), bedId: bed.id, employeeId: emp.id, checkIn, notes: dto.notes, byName: actor.name }));
    });
  }

  async checkout(id: string, date: string | undefined, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'check people out');
    const a = await this.allocations.findOneBy({ id });
    if (!a) throw new NotFoundException('Allocation not found');
    const d = date || todayISO();
    if (a.checkOut && a.checkOut < todayISO()) throw new BadRequestException('Already checked out.');
    if (d < a.checkIn) throw new BadRequestException('Check-out is before check-in.');
    a.checkOut = d;
    return this.allocations.save(a);
  }

  async reportIssue(dto: { unitId: string; title: string; description?: string; employeeId?: string }, actor: Actor) {
    if (!(await this.units.findOneBy({ id: dto.unitId }))) throw new BadRequestException('Pick where the problem is.');
    if (!dto.title?.trim()) throw new BadRequestException('Describe the problem.');
    return this.issues.save(this.issues.create({
      id: newId('AC'), unitId: dto.unitId, title: dto.title.trim(), description: dto.description, employeeId: dto.employeeId,
      status: 'open', reportedByName: actor.name, reportedAt: new Date().toISOString(),
    }));
  }

  async updateIssue(id: string, dto: { status: string; resolution?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'update maintenance complaints');
    if (!['open', 'in_progress', 'resolved'].includes(dto.status)) throw new BadRequestException('Unknown status.');
    const i = await this.issues.findOneBy({ id });
    if (!i) throw new NotFoundException('Complaint not found');
    if (dto.status === 'resolved' && !dto.resolution?.trim() && !i.resolution) throw new BadRequestException('Say how it was resolved.');
    Object.assign(i, { status: dto.status, resolution: dto.resolution ?? i.resolution, resolvedAt: dto.status === 'resolved' ? new Date().toISOString() : undefined });
    return this.issues.save(i);
  }
}
