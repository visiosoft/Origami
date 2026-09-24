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
exports.ShiftsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("./manpower-access.service");
const calendar_util_1 = require("./calendar.util");
const workforce_util_1 = require("./workforce.util");
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['day', 'night', 'twelve_hour', 'weekend', 'emergency'];
const DEFAULT_SHIFTS = [
    { id: 'SH-DAY', name: 'Day shift', code: 'D', kind: 'day', startTime: '08:00', endTime: '17:00', allowancePerDay: 0, color: '#E8B64C', active: true },
    { id: 'SH-NIGHT', name: 'Night shift', code: 'N', kind: 'night', startTime: '20:00', endTime: '05:00', allowancePerDay: 0, color: '#3C5C8A', active: true },
    { id: 'SH-12D', name: '12-hour day', code: 'D12', kind: 'twelve_hour', startTime: '07:00', endTime: '19:00', allowancePerDay: 0, color: '#D08A2E', active: true },
    { id: 'SH-12N', name: '12-hour night', code: 'N12', kind: 'twelve_hour', startTime: '19:00', endTime: '07:00', allowancePerDay: 0, color: '#26406B', active: true },
    { id: 'SH-WKND', name: 'Weekend shift', code: 'W', kind: 'weekend', startTime: '08:00', endTime: '14:00', allowancePerDay: 0, color: '#1F8A72', active: true },
    { id: 'SH-EMRG', name: 'Emergency call-out', code: 'E', kind: 'emergency', startTime: '00:00', endTime: '23:59', allowancePerDay: 0, color: '#8E2E0A', active: true },
];
let ShiftsService = class ShiftsService {
    constructor(templates, assignments, employees, access) {
        this.templates = templates;
        this.assignments = assignments;
        this.employees = employees;
        this.access = access;
        this.log = new common_1.Logger('ShiftsService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.templates.count()) === 0) {
                await this.templates.save(DEFAULT_SHIFTS.map((t, i) => ({ ...t, order: i })));
                this.log.log(`Seeded ${DEFAULT_SHIFTS.length} shift templates`);
            }
        }
        catch (err) {
            this.log.error('Shift seed failed: ' + err.message);
        }
    }
    listTemplates() {
        return this.templates.find({ order: { order: 'ASC' } });
    }
    check(t) {
        if (t.kind && !KINDS.includes(t.kind))
            throw new common_1.BadRequestException('Unknown shift kind.');
        if (t.startTime && !TIME.test(t.startTime))
            throw new common_1.BadRequestException('Start time must be HH:MM.');
        if (t.endTime && !TIME.test(t.endTime))
            throw new common_1.BadRequestException('End time must be HH:MM.');
        if (t.allowancePerDay != null && !(Number(t.allowancePerDay) >= 0))
            throw new common_1.BadRequestException('The allowance cannot be negative.');
    }
    async createTemplate(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change shift templates');
        if (!dto.name?.trim())
            throw new common_1.BadRequestException('Name the shift.');
        const row = { kind: 'day', startTime: '08:00', endTime: '17:00', allowancePerDay: 0, active: true, order: await this.templates.count(), ...dto, name: dto.name.trim() };
        this.check(row);
        return this.templates.save(this.templates.create({ ...row, id: (0, workforce_util_1.newId)('SH') }));
    }
    async updateTemplate(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change shift templates');
        const t = await this.templates.findOneBy({ id });
        if (!t)
            throw new common_1.NotFoundException('Shift not found');
        this.check(dto);
        Object.assign(t, dto, { id });
        return this.templates.save(t);
    }
    async removeTemplate(id, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change shift templates');
        const used = (await this.assignments.find()).some((a) => a.templateIds.includes(id));
        if (used)
            throw new common_1.BadRequestException('Someone has been rostered on this shift -- make it inactive instead.');
        const t = await this.templates.findOneBy({ id });
        if (t)
            await this.templates.remove(t);
        return { id, deleted: true };
    }
    async findAssignments(opts) {
        const where = {};
        if (opts.employeeId)
            where.employeeId = opts.employeeId;
        const rows = await this.assignments.find({ where, order: { startDate: 'DESC' } });
        return rows.filter((a) => (!opts.to || a.startDate <= opts.to) && (!opts.from || !a.endDate || a.endDate >= opts.from));
    }
    async assign(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'roster shifts');
        const ids = Array.from(new Set(dto.employeeIds || []));
        if (!ids.length)
            throw new common_1.BadRequestException('Pick at least one person.');
        if (!ISO.test(dto.startDate || ''))
            throw new common_1.BadRequestException('Give the start date.');
        if (dto.endDate && dto.endDate < dto.startDate)
            throw new common_1.BadRequestException('The end date is before the start date.');
        const templateIds = (dto.templateIds || []).filter(Boolean);
        if (!templateIds.length)
            throw new common_1.BadRequestException('Pick a shift.');
        const found = await this.templates.findBy({ id: (0, typeorm_2.In)(templateIds) });
        if (found.length !== new Set(templateIds).size)
            throw new common_1.BadRequestException('Unknown shift in the selection.');
        const every = templateIds.length > 1 ? Number(dto.rotateEveryDays) : null;
        if (templateIds.length > 1 && (!Number.isInteger(every) || every < 1 || every > 90))
            throw new common_1.BadRequestException('Say how many days each shift in the rotation lasts (1-90).');
        const emps = await this.employees.findBy({ id: (0, typeorm_2.In)(ids) });
        const gone = emps.filter((e) => workforce_util_1.LEFT_STATUSES.includes((0, workforce_util_1.lifecycleStatus)(e)));
        if (emps.length !== ids.length)
            throw new common_1.BadRequestException('Some of those people no longer exist.');
        if (gone.length)
            throw new common_1.BadRequestException(`${gone.map((e) => e.name).join(', ')} no longer work here.`);
        return this.assignments.manager.transaction(async (m) => {
            const repo = m.getRepository(entities_1.ShiftAssignmentEntity);
            const open = (await repo.find({ where: { employeeId: (0, typeorm_2.In)(ids) } })).filter((a) => !a.endDate || a.endDate >= dto.startDate);
            const replaced = open.filter((a) => a.startDate >= dto.startDate);
            const ended = open.filter((a) => a.startDate < dto.startDate);
            if (replaced.length)
                await repo.remove(replaced);
            for (const a of ended)
                Object.assign(a, { endDate: (0, calendar_util_1.addDays)(dto.startDate, -1), endedByName: actor.name });
            if (ended.length)
                await repo.save(ended);
            const now = new Date().toISOString();
            const rows = ids.map((employeeId) => repo.create({
                id: (0, workforce_util_1.newId)('SA'), employeeId, templateIds, rotateEveryDays: every ?? undefined, startDate: dto.startDate,
                endDate: dto.endDate || undefined, notes: dto.notes, createdByName: actor.name, createdAt: now,
            }));
            return repo.save(rows, { chunk: 40 });
        });
    }
    async end(id, endDate, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'roster shifts');
        const a = await this.assignments.findOneBy({ id });
        if (!a)
            throw new common_1.NotFoundException('Shift assignment not found');
        const date = endDate || (0, workforce_util_1.todayISO)();
        if (date < a.startDate)
            throw new common_1.BadRequestException('That is before the assignment started -- delete it instead of ending it.');
        if (a.endDate && a.endDate < date)
            throw new common_1.BadRequestException('This assignment has already ended.');
        Object.assign(a, { endDate: date, endedByName: actor.name });
        return this.assignments.save(a);
    }
    async remove(id, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'roster shifts');
        const a = await this.assignments.findOneBy({ id });
        if (!a)
            throw new common_1.NotFoundException('Shift assignment not found');
        if (a.startDate <= (0, workforce_util_1.todayISO)())
            throw new common_1.BadRequestException('This shift has already started -- end it instead so the history stays.');
        await this.assignments.remove(a);
        return { id, deleted: true };
    }
};
exports.ShiftsService = ShiftsService;
exports.ShiftsService = ShiftsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ShiftTemplateEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ShiftAssignmentEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        manpower_access_service_1.ManpowerAccess])
], ShiftsService);
//# sourceMappingURL=shifts.service.js.map