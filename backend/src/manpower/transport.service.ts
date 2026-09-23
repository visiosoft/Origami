import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeEntity, ProjectEntity, TransportAssignmentEntity, TransportRouteEntity } from '../database/entities';
import { HR_MODULE, ManpowerAccess, type Actor } from './manpower-access.service';
import { addDays } from './calendar.util';
import { LEFT_STATUSES, lifecycleStatus, newId, todayISO } from './workforce.util';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const riding = (a: TransportAssignmentEntity, on: string) => a.startDate <= on && (!a.endDate || a.endDate >= on);

@Injectable()
export class TransportService {
  constructor(
    @InjectRepository(TransportRouteEntity) private readonly routes: Repository<TransportRouteEntity>,
    @InjectRepository(TransportAssignmentEntity) private readonly riders: Repository<TransportAssignmentEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
    private readonly access: ManpowerAccess,
  ) {}

  async list() {
    const today = todayISO();
    const [routes, all] = await Promise.all([this.routes.find({ order: { name: 'ASC' } }), this.riders.find()]);
    const open = all.filter((a) => !a.endDate || a.endDate >= today);
    return routes.map((r) => ({ ...r, riders: open.filter((a) => a.routeId === r.id), riderCount: open.filter((a) => a.routeId === r.id && riding(a, today)).length }));
  }

  async history(employeeId: string) {
    const rows = (await this.riders.find({ where: { employeeId } })).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const routes = await this.routes.find();
    return rows.map((a) => ({ ...a, route: routes.find((r) => r.id === a.routeId) }));
  }

  private async check(dto: Partial<TransportRouteEntity>) {
    if (dto.capacity != null && (!Number.isInteger(Number(dto.capacity)) || Number(dto.capacity) < 0 || Number(dto.capacity) > 200)) throw new BadRequestException('Capacity must be a whole number of seats.');
    for (const k of ['departureTime', 'returnTime'] as const) if (dto[k] && !TIME.test(dto[k]!)) throw new BadRequestException('Times must be HH:MM.');
    if (dto.driverEmployeeId && !(await this.employees.findOneBy({ id: dto.driverEmployeeId }))) throw new BadRequestException('The driver is not on file.');
    if (dto.projectId != null && !(await this.projects.findOneBy({ id: Number(dto.projectId) }))) throw new BadRequestException('Unknown project.');
    if (dto.status && !['active', 'suspended'].includes(dto.status)) throw new BadRequestException('Status is active or suspended.');
  }

  async create(dto: Partial<TransportRouteEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'manage transport');
    if (!dto.name?.trim()) throw new BadRequestException('Name the route.');
    await this.check(dto);
    return this.routes.save(this.routes.create({
      capacity: 0, status: 'active', ...dto, name: dto.name.trim(),
      pickupPoints: (dto.pickupPoints || []).map((p) => p.trim()).filter(Boolean), id: newId('TR'), createdAt: new Date().toISOString(),
    }));
  }

  async update(id: string, dto: Partial<TransportRouteEntity>, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'manage transport');
    const r = await this.routes.findOneBy({ id });
    if (!r) throw new NotFoundException('Route not found');
    await this.check(dto);
    if (dto.capacity != null) {
      const riders = (await this.riders.find({ where: { routeId: id } })).filter((a) => riding(a, todayISO())).length;
      if (Number(dto.capacity) < riders) throw new BadRequestException(`${riders} people ride this route -- capacity can't go below that.`);
    }
    Object.assign(r, dto, { id, pickupPoints: dto.pickupPoints ? dto.pickupPoints.map((p) => p.trim()).filter(Boolean) : r.pickupPoints });
    return this.routes.save(r);
  }

  async remove(id: string, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'manage transport');
    if (await this.riders.count({ where: { routeId: id } })) throw new BadRequestException('This route has rider history -- suspend it instead.');
    const r = await this.routes.findOneBy({ id });
    if (r) await this.routes.remove(r);
    return { id, deleted: true };
  }

  /** Add a rider. Someone already on another route moves: their old seat ends the day before. */
  async addRider(routeId: string, dto: { employeeId: string; pickupPoint?: string; startDate?: string }, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'manage transport');
    const route = await this.routes.findOneBy({ id: routeId });
    if (!route) throw new NotFoundException('Route not found');
    if (route.status !== 'active') throw new BadRequestException('This route is suspended.');
    const emp = await this.employees.findOneBy({ id: dto.employeeId });
    if (!emp) throw new BadRequestException('Pick the employee.');
    if (LEFT_STATUSES.includes(lifecycleStatus(emp))) throw new BadRequestException(`${emp.name} no longer works here.`);
    const start = dto.startDate || todayISO();
    return this.riders.manager.transaction(async (m) => {
      const repo = m.getRepository(TransportAssignmentEntity);
      const all = await repo.find();
      const onRoute = all.filter((a) => a.routeId === routeId && riding(a, start));
      if (onRoute.some((a) => a.employeeId === emp.id)) throw new BadRequestException(`${emp.name} already rides this route.`);
      if (route.capacity && onRoute.length >= route.capacity) throw new BadRequestException(`${route.name} is full (${route.capacity} seats).`);
      const elsewhere = all.filter((a) => a.employeeId === emp.id && (!a.endDate || a.endDate >= start));
      for (const a of elsewhere) {
        if (a.startDate >= start) throw new BadRequestException(`${emp.name} is already booked on a route from ${a.startDate}.`);
        a.endDate = addDays(start, -1);
      }
      if (elsewhere.length) await repo.save(elsewhere);
      return repo.save(repo.create({ id: newId('TA'), routeId, employeeId: emp.id, pickupPoint: dto.pickupPoint, startDate: start, byName: actor.name }));
    });
  }

  async endRider(id: string, date: string | undefined, actor: Actor) {
    await this.access.require(actor, HR_MODULE, 'manage transport');
    const a = await this.riders.findOneBy({ id });
    if (!a) throw new NotFoundException('Not found');
    const d = date || todayISO();
    if (d < a.startDate) throw new BadRequestException('That is before they started riding.');
    a.endDate = d;
    return this.riders.save(a);
  }
}
