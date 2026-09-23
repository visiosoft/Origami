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
exports.AssignmentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const workforce_util_1 = require("./workforce.util");
let AssignmentsService = class AssignmentsService {
    constructor(repo, employees, projects) {
        this.repo = repo;
        this.employees = employees;
        this.projects = projects;
    }
    hydrate(a) {
        return { ...a, current: (0, workforce_util_1.isOpen)(a) };
    }
    async findAll(opts) {
        const where = {};
        if (opts.employeeId)
            where.employeeId = opts.employeeId;
        if (opts.projectId != null)
            where.projectId = opts.projectId;
        if (opts.workforceRequestId)
            where.workforceRequestId = opts.workforceRequestId;
        const rows = await this.repo.find({ where, order: { startDate: 'DESC' } });
        const shown = opts.status === 'current' ? rows.filter((a) => (0, workforce_util_1.isOpen)(a))
            : opts.status === 'ended' ? rows.filter((a) => !(0, workforce_util_1.isOpen)(a))
                : rows;
        return shown.map((a) => this.hydrate(a));
    }
    async openRegularByEmployee() {
        const rows = await this.repo.find({ where: { status: 'active', assignmentType: 'regular' } });
        return new Map(rows.filter((a) => (0, workforce_util_1.isOpen)(a)).map((a) => [a.employeeId, a]));
    }
    async requireProject(projectId) {
        const project = await this.projects.findOneBy({ id: Number(projectId) });
        if (!project)
            throw new common_1.BadRequestException(`Project ${projectId} does not exist.`);
        return project;
    }
    checkDates(start, end) {
        if (end && end < start)
            throw new common_1.BadRequestException('The end date is before the start date.');
    }
    async assign(dto, actor) {
        const ids = Array.from(new Set(dto.employeeIds || []));
        if (!ids.length)
            throw new common_1.BadRequestException('Pick at least one worker.');
        await this.requireProject(dto.projectId);
        const startDate = dto.startDate || (0, workforce_util_1.todayISO)();
        this.checkDates(startDate, dto.endDate);
        const type = dto.assignmentType === 'temporary' ? 'temporary' : 'regular';
        if (type === 'temporary' && !dto.endDate)
            throw new common_1.BadRequestException('A temporary assignment needs an end date.');
        return this.repo.manager.transaction(async (m) => {
            const emps = await m.getRepository(entities_1.EmployeeEntity).findBy({ id: (0, typeorm_2.In)(ids) });
            const byId = new Map(emps.map((e) => [e.id, e]));
            const open = type === 'regular'
                ? (await m.getRepository(entities_1.EmployeeAssignmentEntity).find({ where: { employeeId: (0, typeorm_2.In)(ids), status: 'active', assignmentType: 'regular' } })).filter((a) => (0, workforce_util_1.isOpen)(a, startDate))
                : [];
            const problems = [];
            for (const id of ids) {
                const e = byId.get(id);
                if (!e)
                    problems.push(`${id} not found`);
                else if (!(0, workforce_util_1.isDeployable)(e))
                    problems.push(`${e.name} is not active`);
                else if (open.some((a) => a.employeeId === id))
                    problems.push(`${e.name} is already deployed -- transfer them instead`);
            }
            if (problems.length)
                throw new common_1.BadRequestException(problems.join('; '));
            const now = new Date().toISOString();
            const rows = ids.map((id) => {
                const e = byId.get(id);
                return m.getRepository(entities_1.EmployeeAssignmentEntity).create({
                    id: (0, workforce_util_1.newId)('ASG'), employeeId: id, projectId: Number(dto.projectId), workArea: dto.workArea,
                    tradeId: e.tradeId, designation: dto.designation || e.designation || e.jobTitle,
                    assignmentType: type, startDate, endDate: dto.endDate, status: 'active',
                    workforceRequestId: dto.workforceRequestId, requestLineId: dto.requestLineId,
                    notes: dto.notes, createdByName: actor.name, createdAt: now, updatedAt: now,
                });
            });
            const saved = await m.getRepository(entities_1.EmployeeAssignmentEntity).save(rows);
            return saved.map((a) => this.hydrate(a));
        });
    }
    async requireOpen(m, id) {
        const a = await m.getRepository(entities_1.EmployeeAssignmentEntity).findOneBy({ id });
        if (!a)
            throw new common_1.NotFoundException(`Assignment ${id} not found`);
        if (!(0, workforce_util_1.isOpen)(a))
            throw new common_1.BadRequestException('This assignment has already ended.');
        return a;
    }
    async transfer(id, dto, actor) {
        await this.requireProject(dto.projectId);
        const effective = dto.startDate || (0, workforce_util_1.todayISO)();
        return this.repo.manager.transaction(async (m) => {
            const repo = m.getRepository(entities_1.EmployeeAssignmentEntity);
            const from = await this.requireOpen(m, id);
            if (effective < from.startDate)
                throw new common_1.BadRequestException('A transfer cannot take effect before the current assignment started.');
            if (Number(dto.projectId) === from.projectId && (dto.workArea || '') === (from.workArea || '')) {
                throw new common_1.BadRequestException('That is the same project and work area they are already on.');
            }
            const now = new Date().toISOString();
            Object.assign(from, { status: 'ended', endDate: effective, endReason: 'transfer', endedByName: actor.name, updatedAt: now });
            await repo.save(from);
            const to = repo.create({
                id: (0, workforce_util_1.newId)('ASG'), employeeId: from.employeeId, projectId: Number(dto.projectId), workArea: dto.workArea,
                tradeId: from.tradeId, designation: dto.designation || from.designation, assignmentType: from.assignmentType,
                startDate: effective, status: 'active', transferredFromId: from.id, notes: dto.notes,
                createdByName: actor.name, createdAt: now, updatedAt: now,
            });
            return this.hydrate(await repo.save(to));
        });
    }
    async release(id, dto, actor) {
        return this.repo.manager.transaction(async (m) => {
            const a = await this.requireOpen(m, id);
            const endDate = dto.endDate || (0, workforce_util_1.todayISO)();
            this.checkDates(a.startDate, endDate);
            Object.assign(a, {
                status: 'ended', endDate, endReason: 'completed', endedByName: actor.name, updatedAt: new Date().toISOString(),
                notes: dto.notes ? [a.notes, dto.notes].filter(Boolean).join('\n') : a.notes,
            });
            return this.hydrate(await m.getRepository(entities_1.EmployeeAssignmentEntity).save(a));
        });
    }
    async demobilize(employeeId, dto, actor) {
        const date = dto.date || (0, workforce_util_1.todayISO)();
        return this.repo.manager.transaction(async (m) => {
            const emp = await m.getRepository(entities_1.EmployeeEntity).findOneBy({ id: employeeId });
            if (!emp)
                throw new common_1.NotFoundException(`Employee ${employeeId} not found`);
            const repo = m.getRepository(entities_1.EmployeeAssignmentEntity);
            const open = (await repo.find({ where: { employeeId, status: 'active' } })).filter((a) => (0, workforce_util_1.isOpen)(a, date));
            const now = new Date().toISOString();
            for (const a of open) {
                Object.assign(a, { status: 'ended', endDate: date < a.startDate ? a.startDate : date, endReason: 'demobilized', endedByName: actor.name, updatedAt: now });
            }
            if (open.length)
                await repo.save(open);
            Object.assign(emp, { employmentStatus: 'demobilized', status: 'inactive', updatedAt: now });
            await m.getRepository(entities_1.EmployeeEntity).save(emp);
            return { employeeId, ended: open.length };
        });
    }
    async update(id, dto) {
        return this.repo.manager.transaction(async (m) => {
            const a = await this.requireOpen(m, id);
            if (dto.endDate !== undefined)
                this.checkDates(a.startDate, dto.endDate || undefined);
            for (const k of ['workArea', 'designation', 'endDate', 'notes']) {
                if (dto[k] !== undefined)
                    a[k] = dto[k] || null;
            }
            if (a.assignmentType === 'temporary' && !a.endDate)
                throw new common_1.BadRequestException('A temporary assignment needs an end date.');
            a.updatedAt = new Date().toISOString();
            return this.hydrate(await m.getRepository(entities_1.EmployeeAssignmentEntity).save(a));
        });
    }
};
exports.AssignmentsService = AssignmentsService;
exports.AssignmentsService = AssignmentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.EmployeeAssignmentEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AssignmentsService);
//# sourceMappingURL=assignments.service.js.map