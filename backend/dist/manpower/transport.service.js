"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("./manpower-access.service");
const calendar_util_1 = require("./calendar.util");
const workforce_util_1 = require("./workforce.util");
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const riding = (a, on) => a.startDate <= on && (!a.endDate || a.endDate >= on);
let TransportService = class TransportService {
    constructor(routes, riders, employees, projects, access) {
        this.routes = routes;
        this.riders = riders;
        this.employees = employees;
        this.projects = projects;
        this.access = access;
    }
    async list() {
        const today = (0, workforce_util_1.todayISO)();
        const [routes, all] = await Promise.all([this.routes.find({ order: { name: 'ASC' } }), this.riders.find()]);
        const open = all.filter((a) => !a.endDate || a.endDate >= today);
        return routes.map((r) => ({ ...r, riders: open.filter((a) => a.routeId === r.id), riderCount: open.filter((a) => a.routeId === r.id && riding(a, today)).length }));
    }
    async history(employeeId) {
        const rows = (await this.riders.find({ where: { employeeId } })).sort((a, b) => b.startDate.localeCompare(a.startDate));
        const routes = await this.routes.find();
        return rows.map((a) => ({ ...a, route: routes.find((r) => r.id === a.routeId) }));
    }
    async check(dto) {
        if (dto.capacity != null && (!Number.isInteger(Number(dto.capacity)) || Number(dto.capacity) < 0 || Number(dto.capacity) > 200))
            throw new common_1.BadRequestException('Capacity must be a whole number of seats.');
        for (const k of ['departureTime', 'returnTime'])
            if (dto[k] && !TIME.test(dto[k]))
                throw new common_1.BadRequestException('Times must be HH:MM.');
        if (dto.driverEmployeeId && !(await this.employees.findOneBy({ id: dto.driverEmployeeId })))
            throw new common_1.BadRequestException('The driver is not on file.');
        if (dto.projectId != null && !(await this.projects.findOneBy({ id: Number(dto.projectId) })))
            throw new common_1.BadRequestException('Unknown project.');
        if (dto.status && !['active', 'suspended'].includes(dto.status))
            throw new common_1.BadRequestException('Status is active or suspended.');
    }
    async create(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'manage transport');
        if (!dto.name?.trim())
            throw new common_1.BadRequestException('Name the route.');
        await this.check(dto);
        return this.routes.save(this.routes.create({
            capacity: 0, status: 'active', ...dto, name: dto.name.trim(),
            pickupPoints: (dto.pickupPoints || []).map((p) => p.trim()).filter(Boolean), id: (0, workforce_util_1.newId)('TR'), createdAt: new Date().toISOString(),
        }));
    }
    async update(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'manage transport');
        const r = await this.routes.findOneBy({ id });
        if (!r)
            throw new common_1.NotFoundException('Route not found');
        await this.check(dto);
        if (dto.capacity != null) {
            const riders = (await this.riders.find({ where: { routeId: id } })).filter((a) => riding(a, (0, workforce_util_1.todayISO)())).length;
            if (Number(dto.capacity) < riders)
                throw new common_1.BadRequestException(`${riders} people ride this route -- capacity can't go below that.`);
        }
        Object.assign(r, dto, { id, pickupPoints: dto.pickupPoints ? dto.pickupPoints.map((p) => p.trim()).filter(Boolean) : r.pickupPoints });
        return this.routes.save(r);
    }
    async remove(id, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'manage transport');
        if (await this.riders.count({ where: { routeId: id } }))
            throw new common_1.BadRequestException('This route has rider history -- suspend it instead.');
        const r = await this.routes.findOneBy({ id });
        if (r)
            await this.routes.remove(r);
        return { id, deleted: true };
    }
    async addRider(routeId, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'manage transport');
        const route = await this.routes.findOneBy({ id: routeId });
        if (!route)
            throw new common_1.NotFoundException('Route not found');
        if (route.status !== 'active')
            throw new common_1.BadRequestException('This route is suspended.');
        const emp = await this.employees.findOneBy({ id: dto.employeeId });
        if (!emp)
            throw new common_1.BadRequestException('Pick the employee.');
        if (workforce_util_1.LEFT_STATUSES.includes((0, workforce_util_1.lifecycleStatus)(emp)))
            throw new common_1.BadRequestException(`${emp.name} no longer works here.`);
        const start = dto.startDate || (0, workforce_util_1.todayISO)();
        return this.riders.manager.transaction(async (m) => {
            const repo = m.getRepository(entities_1.TransportAssignmentEntity);
            const all = await repo.find();
            const onRoute = all.filter((a) => a.routeId === routeId && riding(a, start));
            if (onRoute.some((a) => a.employeeId === emp.id))
                throw new common_1.BadRequestException(`${emp.name} already rides this route.`);
            if (route.capacity && onRoute.length >= route.capacity)
                throw new common_1.BadRequestException(`${route.name} is full (${route.capacity} seats).`);
            const elsewhere = all.filter((a) => a.employeeId === emp.id && (!a.endDate || a.endDate >= start));
            for (const a of elsewhere) {
                if (a.startDate >= start)
                    throw new common_1.BadRequestException(`${emp.name} is already booked on a route from ${a.startDate}.`);
                a.endDate = (0, calendar_util_1.addDays)(start, -1);
            }
            if (elsewhere.length)
                await repo.save(elsewhere);
            return repo.save(repo.create({ id: (0, workforce_util_1.newId)('TA'), routeId, employeeId: emp.id, pickupPoint: dto.pickupPoint, startDate: start, byName: actor.name }));
        });
    }
    async endRider(id, date, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'manage transport');
        const a = await this.riders.findOneBy({ id });
        if (!a)
            throw new common_1.NotFoundException('Not found');
        const d = date || (0, workforce_util_1.todayISO)();
        if (d < a.startDate)
            throw new common_1.BadRequestException('That is before they started riding.');
        a.endDate = d;
        return this.riders.save(a);
    }
};
exports.TransportService = TransportService;
exports.TransportService = TransportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.TransportRouteEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.TransportAssignmentEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        manpower_access_service_1.ManpowerAccess])
], TransportService);
//# sourceMappingURL=transport.service.js.map