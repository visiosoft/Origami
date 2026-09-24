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
exports.OvertimeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("./manpower-access.service");
const payroll_setup_service_1 = require("./payroll-setup.service");
const weekly_timesheets_service_1 = require("./weekly-timesheets.service");
const payroll_calc_1 = require("./payroll.calc");
const workforce_util_1 = require("./workforce.util");
const OT_TYPES = ['normal', 'weekend', 'holiday', 'night'];
let OvertimeService = class OvertimeService {
    constructor(repo, employees, logs, entries, setup, access, holidays, timesheets, timesheetLines) {
        this.repo = repo;
        this.employees = employees;
        this.logs = logs;
        this.entries = entries;
        this.setup = setup;
        this.access = access;
        this.holidays = holidays;
        this.timesheets = timesheets;
        this.timesheetLines = timesheetLines;
    }
    async findAll(opts) {
        const qb = this.repo.createQueryBuilder('o');
        if (opts.employeeId)
            qb.andWhere('o.employeeId = :employeeId', { employeeId: opts.employeeId });
        if (opts.status)
            qb.andWhere('o.status = :status', { status: opts.status });
        if (opts.from)
            qb.andWhere('o.date >= :from', { from: opts.from });
        if (opts.to)
            qb.andWhere('o.date <= :to', { to: opts.to });
        return qb.orderBy('o.date', 'DESC').getMany();
    }
    validate(dto) {
        if (!dto.employeeId)
            throw new common_1.BadRequestException('Pick the employee.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.date || ''))
            throw new common_1.BadRequestException('Give the date the overtime was worked.');
        const hours = Number(dto.hours);
        if (!(hours > 0) || hours > 16)
            throw new common_1.BadRequestException('Overtime hours must be more than 0 and at most 16 in a day.');
        if (dto.otType && !OT_TYPES.includes(dto.otType))
            throw new common_1.BadRequestException('Unknown overtime type.');
        if (dto.rate != null && !(Number(dto.rate) > 0))
            throw new common_1.BadRequestException('An override rate must be above 0.');
    }
    async build(dto, actor) {
        this.validate(dto);
        const emp = await this.employees.findOneBy({ id: dto.employeeId });
        if (!emp)
            throw new common_1.BadRequestException('That employee does not exist.');
        const now = new Date().toISOString();
        return this.repo.create({
            id: (0, workforce_util_1.newId)('OT'), employeeId: dto.employeeId, projectId: dto.projectId ?? undefined, date: dto.date, hours: (0, payroll_calc_1.round2)(Number(dto.hours)),
            otType: dto.otType || 'normal', rate: dto.rate != null ? Number(dto.rate) : undefined, reason: dto.reason,
            source: dto.source === 'daily_log' ? 'daily_log' : 'manual', status: 'pending',
            requestedById: actor.id, requestedByName: actor.name, createdAt: now, updatedAt: now,
        });
    }
    async create(dto, actor) {
        return this.repo.save(await this.build(dto, actor));
    }
    async bulkCreate(items, actor) {
        if (!items?.length)
            throw new common_1.BadRequestException('Nothing to create.');
        const rows = [];
        for (const item of items)
            rows.push(await this.build(item, actor));
        return this.repo.save(rows, { chunk: 40 });
    }
    async load(id) {
        const o = await this.repo.findOneBy({ id });
        if (!o)
            throw new common_1.NotFoundException('Overtime request not found');
        return o;
    }
    async assertIndependent(o, actor, verb) {
        if (actor.id && actor.id === o.requestedById)
            throw new common_1.ForbiddenException(`You can't ${verb} overtime you requested.`);
        const emp = await this.employees.findOneBy({ id: o.employeeId });
        if (actor.id && emp?.userId && emp.userId === actor.id)
            throw new common_1.ForbiddenException(`You can't ${verb} your own overtime.`);
        return emp;
    }
    async approve(id, note, actor) {
        const o = await this.load(id);
        if (o.status !== 'pending')
            throw new common_1.BadRequestException(`This request is already ${o.status}.`);
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'approve overtime');
        const emp = await this.assertIndependent(o, actor, 'approve');
        if (!emp)
            throw new common_1.BadRequestException('The employee no longer exists.');
        const s = await this.setup.settings();
        const baseRate = (0, payroll_calc_1.round2)(o.rate || (0, payroll_calc_1.overtimeBase)(emp, s));
        if (!(baseRate > 0))
            throw new common_1.BadRequestException(`${emp.name} has no pay rate set -- add one (or an overtime rate) before approving.`);
        const multiplier = s.otMultipliers[o.otType || 'normal'] ?? s.otMultipliers.normal;
        Object.assign(o, {
            status: 'approved', baseRate, multiplier, amount: (0, payroll_calc_1.round2)(o.hours * baseRate * multiplier),
            decidedByName: actor.name, decidedAt: new Date().toISOString(), decisionNote: note || '', updatedAt: new Date().toISOString(),
        });
        return this.repo.save(o);
    }
    async reject(id, note, actor) {
        const o = await this.load(id);
        if (o.status !== 'pending')
            throw new common_1.BadRequestException(`This request is already ${o.status}.`);
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'reject overtime');
        await this.assertIndependent(o, actor, 'reject');
        Object.assign(o, { status: 'rejected', decidedByName: actor.name, decidedAt: new Date().toISOString(), decisionNote: note || '', updatedAt: new Date().toISOString() });
        return this.repo.save(o);
    }
    async cancel(id, actor) {
        const o = await this.load(id);
        if (o.payrollRunId)
            throw new common_1.BadRequestException('This overtime is already in a payroll run.');
        if (!['pending', 'approved'].includes(o.status))
            throw new common_1.BadRequestException(`A ${o.status} request can't be cancelled.`);
        Object.assign(o, { status: 'cancelled', decidedByName: actor.name, decidedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return this.repo.save(o);
    }
    async suggestions(from, to) {
        const s = await this.setup.settings();
        const logs = await this.logs.createQueryBuilder('l')
            .where('l.status = :st', { st: 'approved' })
            .andWhere('l.date >= :from AND l.date <= :to', { from, to })
            .getMany();
        const byLog = new Map(logs.map((l) => [l.id, l]));
        const entries = logs.length ? await this.entries.find({ where: { dailyLogId: (0, typeorm_2.In)(logs.map((l) => l.id)) } }) : [];
        const perDay = new Map();
        for (const e of entries) {
            const log = byLog.get(e.dailyLogId);
            const key = `${e.employeeId}|${log.date}`;
            const cur = perDay.get(key) || { employeeId: e.employeeId, date: log.date, hours: 0, projectIds: new Set() };
            cur.hours += Number(e.hours) || 0;
            cur.projectIds.add(log.projectId);
            perDay.set(key, cur);
        }
        if (this.timesheets && this.timesheetLines) {
            for (const [employeeId, days] of await (0, weekly_timesheets_service_1.approvedTimesheetHours)(this.timesheets, this.timesheetLines, from, to)) {
                for (const [date, d] of days)
                    perDay.set(`${employeeId}|${date}`, { employeeId, date, hours: d.hours, projectIds: d.projectIds });
            }
        }
        if (!perDay.size)
            return [];
        const existing = await this.repo.createQueryBuilder('o')
            .where('o.date >= :from AND o.date <= :to', { from, to })
            .andWhere('o.status IN (:...st)', { st: ['pending', 'approved'] })
            .getMany();
        const taken = new Set(existing.map((o) => `${o.employeeId}|${o.date}`));
        const hol = new Set(((await this.holidays?.find()) || []).map((h) => h.date));
        return Array.from(perDay.entries())
            .filter(([key, d]) => d.hours > s.standardDayHours && !taken.has(key))
            .map(([, d]) => ({
            employeeId: d.employeeId, date: d.date, loggedHours: (0, payroll_calc_1.round2)(d.hours), overtimeHours: (0, payroll_calc_1.round2)(d.hours - s.standardDayHours),
            projectId: d.projectIds.size === 1 ? Array.from(d.projectIds)[0] : undefined,
            otType: hol.has(d.date) ? 'holiday' : s.weekendDays.includes(new Date(d.date + 'T00:00:00Z').getUTCDay()) ? 'weekend' : 'normal',
        }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
};
exports.OvertimeService = OvertimeService;
exports.OvertimeService = OvertimeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.OvertimeRequestEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.DailyLogEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.LaborLogEntryEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.PublicHolidayEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.TimesheetEntity)),
    __param(8, (0, typeorm_1.InjectRepository)(entities_1.TimesheetLineEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        payroll_setup_service_1.PayrollSetupService,
        manpower_access_service_1.ManpowerAccess,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], OvertimeService);
//# sourceMappingURL=overtime.service.js.map