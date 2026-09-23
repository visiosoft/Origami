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
exports.AccommodationService = exports.LEVELS = void 0;
exports.validParent = validParent;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("./manpower-access.service");
const calendar_util_1 = require("./calendar.util");
const workforce_util_1 = require("./workforce.util");
exports.LEVELS = ['camp', 'building', 'floor', 'room', 'bed'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function validParent(level, parentLevel) {
    const i = exports.LEVELS.indexOf(level);
    if (i < 0)
        return false;
    if (i === 0)
        return parentLevel === null;
    if (level === 'room')
        return parentLevel === 'floor' || parentLevel === 'building';
    return parentLevel === exports.LEVELS[i - 1];
}
let AccommodationService = class AccommodationService {
    constructor(units, allocations, issues, employees, access) {
        this.units = units;
        this.allocations = allocations;
        this.issues = issues;
        this.employees = employees;
        this.access = access;
    }
    async overview() {
        const today = (0, workforce_util_1.todayISO)();
        const [units, allocs, issues] = await Promise.all([this.units.find(), this.allocations.find(), this.issues.find()]);
        const current = allocs.filter((a) => !a.checkOut || a.checkOut >= today);
        return { units, allocations: current, issues: issues.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)) };
    }
    async history(employeeId) {
        const allocs = (await this.allocations.find({ where: { employeeId } })).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
        const units = await this.units.find();
        const byId = new Map(units.map((u) => [u.id, u]));
        const path = (id) => { const out = []; let u = byId.get(id); while (u) {
            out.unshift(u.name);
            u = u.parentId ? byId.get(u.parentId) : undefined;
        } return out.join(' › '); };
        return allocs.map((a) => ({ ...a, location: path(a.bedId) }));
    }
    async createUnit(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'manage accommodation');
        const parent = dto.parentId ? await this.units.findOneBy({ id: dto.parentId }) : null;
        if (dto.parentId && !parent)
            throw new common_1.BadRequestException('Parent not found.');
        if (!validParent(dto.level, parent?.level ?? null))
            throw new common_1.BadRequestException(`A ${dto.level} can't go inside a ${parent?.level ?? 'nothing'}.`);
        const now = new Date().toISOString();
        if (dto.level === 'bed' && dto.count) {
            const n = Number(dto.count);
            if (!Number.isInteger(n) || n < 1 || n > 50)
                throw new common_1.BadRequestException('Add between 1 and 50 beds at a time.');
            const siblings = (await this.units.find({ where: { parentId: parent.id } })).length;
            return this.units.save(Array.from({ length: n }, (_, i) => this.units.create({ id: (0, workforce_util_1.newId)('AU'), parentId: parent.id, level: 'bed', name: `Bed ${siblings + i + 1}`, active: true, createdAt: now })));
        }
        if (!dto.name?.trim())
            throw new common_1.BadRequestException(`Name the ${dto.level}.`);
        return this.units.save(this.units.create({ id: (0, workforce_util_1.newId)('AU'), parentId: parent?.id, level: dto.level, name: dto.name.trim(), active: true, createdAt: now }));
    }
    async updateUnit(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'manage accommodation');
        const u = await this.units.findOneBy({ id });
        if (!u)
            throw new common_1.NotFoundException('Not found');
        if (dto.active === false && (await this.occupiedBeds(id)).length)
            throw new common_1.BadRequestException('People are allocated here -- check them out first.');
        if (dto.name !== undefined && !dto.name.trim())
            throw new common_1.BadRequestException('A name is required.');
        Object.assign(u, { ...dto, name: dto.name?.trim() ?? u.name });
        return this.units.save(u);
    }
    async descendants(id) {
        const all = await this.units.find();
        const out = [];
        const walk = (pid) => all.filter((u) => u.parentId === pid).forEach((u) => { out.push(u); walk(u.id); });
        walk(id);
        return out;
    }
    async occupiedBeds(id) {
        const beds = [...(await this.descendants(id)), ...(await this.units.findBy({ id }))].filter((u) => u.level === 'bed').map((u) => u.id);
        const today = (0, workforce_util_1.todayISO)();
        return (await this.allocations.find()).filter((a) => beds.includes(a.bedId) && (!a.checkOut || a.checkOut >= today));
    }
    async removeUnit(id, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'manage accommodation');
        const u = await this.units.findOneBy({ id });
        if (!u)
            return { id, deleted: true };
        const subtree = [u, ...(await this.descendants(id))];
        const beds = subtree.filter((x) => x.level === 'bed').map((x) => x.id);
        if ((await this.allocations.find()).some((a) => beds.includes(a.bedId)))
            throw new common_1.BadRequestException('Beds here have allocation history -- deactivate instead of deleting.');
        await this.units.remove(subtree);
        return { id, deleted: subtree.length };
    }
    async allocate(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'allocate beds');
        const bed = await this.units.findOneBy({ id: dto.bedId });
        if (!bed || bed.level !== 'bed')
            throw new common_1.BadRequestException('Pick a bed.');
        if (!bed.active)
            throw new common_1.BadRequestException('That bed is out of use.');
        const emp = await this.employees.findOneBy({ id: dto.employeeId });
        if (!emp)
            throw new common_1.BadRequestException('Pick the employee.');
        if (workforce_util_1.LEFT_STATUSES.includes((0, workforce_util_1.lifecycleStatus)(emp)))
            throw new common_1.BadRequestException(`${emp.name} no longer works here.`);
        const checkIn = dto.checkIn || (0, workforce_util_1.todayISO)();
        if (!ISO.test(checkIn))
            throw new common_1.BadRequestException('Give the check-in date.');
        return this.allocations.manager.transaction(async (m) => {
            const repo = m.getRepository(entities_1.BedAllocationEntity);
            const all = await repo.find();
            const inBed = all.find((a) => a.bedId === bed.id && (!a.checkOut || a.checkOut >= checkIn));
            if (inBed) {
                const who = await this.employees.findOneBy({ id: inBed.employeeId });
                throw new common_1.BadRequestException(`${bed.name} is taken by ${who?.name || 'someone'} -- check them out first.`);
            }
            const mine = all.filter((a) => a.employeeId === emp.id && (!a.checkOut || a.checkOut >= checkIn));
            for (const a of mine) {
                if (a.checkIn >= checkIn)
                    throw new common_1.BadRequestException(`${emp.name} already has a bed from ${a.checkIn}.`);
                a.checkOut = (0, calendar_util_1.addDays)(checkIn, -1);
            }
            if (mine.length)
                await repo.save(mine);
            return repo.save(repo.create({ id: (0, workforce_util_1.newId)('BA'), bedId: bed.id, employeeId: emp.id, checkIn, notes: dto.notes, byName: actor.name }));
        });
    }
    async checkout(id, date, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'check people out');
        const a = await this.allocations.findOneBy({ id });
        if (!a)
            throw new common_1.NotFoundException('Allocation not found');
        const d = date || (0, workforce_util_1.todayISO)();
        if (a.checkOut && a.checkOut < (0, workforce_util_1.todayISO)())
            throw new common_1.BadRequestException('Already checked out.');
        if (d < a.checkIn)
            throw new common_1.BadRequestException('Check-out is before check-in.');
        a.checkOut = d;
        return this.allocations.save(a);
    }
    async reportIssue(dto, actor) {
        if (!(await this.units.findOneBy({ id: dto.unitId })))
            throw new common_1.BadRequestException('Pick where the problem is.');
        if (!dto.title?.trim())
            throw new common_1.BadRequestException('Describe the problem.');
        return this.issues.save(this.issues.create({
            id: (0, workforce_util_1.newId)('AC'), unitId: dto.unitId, title: dto.title.trim(), description: dto.description, employeeId: dto.employeeId,
            status: 'open', reportedByName: actor.name, reportedAt: new Date().toISOString(),
        }));
    }
    async updateIssue(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'update maintenance complaints');
        if (!['open', 'in_progress', 'resolved'].includes(dto.status))
            throw new common_1.BadRequestException('Unknown status.');
        const i = await this.issues.findOneBy({ id });
        if (!i)
            throw new common_1.NotFoundException('Complaint not found');
        if (dto.status === 'resolved' && !dto.resolution?.trim() && !i.resolution)
            throw new common_1.BadRequestException('Say how it was resolved.');
        Object.assign(i, { status: dto.status, resolution: dto.resolution ?? i.resolution, resolvedAt: dto.status === 'resolved' ? new Date().toISOString() : undefined });
        return this.issues.save(i);
    }
};
exports.AccommodationService = AccommodationService;
exports.AccommodationService = AccommodationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.AccommodationUnitEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.BedAllocationEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.AccommodationIssueEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        manpower_access_service_1.ManpowerAccess])
], AccommodationService);
//# sourceMappingURL=accommodation.service.js.map