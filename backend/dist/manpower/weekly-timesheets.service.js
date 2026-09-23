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
exports.WeeklyTimesheetsService = exports.weekDates = exports.mondayOf = exports.INTERNAL_CATEGORIES = exports.TIMESHEET_KINDS = void 0;
exports.approvedTimesheetHours = approvedTimesheetHours;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("./manpower-access.service");
const leave_service_1 = require("./leave.service");
const payroll_setup_service_1 = require("./payroll-setup.service");
const timesheets_service_1 = require("./timesheets.service");
const calendar_util_1 = require("./calendar.util");
const workforce_util_1 = require("./workforce.util");
const payroll_calc_1 = require("./payroll.calc");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
exports.TIMESHEET_KINDS = ['project', 'internal', 'leave'];
exports.INTERNAL_CATEGORIES = ['office', 'estimating', 'design', 'meetings', 'travel', 'other'];
const mondayOf = (date) => (0, calendar_util_1.addDays)(date, -(((0, calendar_util_1.weekday)(date) + 6) % 7));
exports.mondayOf = mondayOf;
const weekDates = (weekStart) => Array.from({ length: 7 }, (_, i) => (0, calendar_util_1.addDays)(weekStart, i));
exports.weekDates = weekDates;
async function approvedTimesheetHours(sheets, lines, from, to, employeeIds) {
    const out = new Map();
    const approved = (await sheets.find({ where: { status: 'approved' } }))
        .filter((s) => s.weekStart <= to && (0, calendar_util_1.addDays)(s.weekStart, 6) >= from && (!employeeIds || employeeIds.has(s.employeeId)));
    if (!approved.length)
        return out;
    for (const l of await lines.find({ where: { timesheetId: (0, typeorm_2.In)(approved.map((s) => s.id)) } })) {
        if (l.kind === 'leave')
            continue;
        for (const [date, d] of Object.entries(l.days || {})) {
            if (date < from || date > to || !(Number(d?.hours) > 0))
                continue;
            const mine = out.get(l.employeeId) || new Map();
            const cur = mine.get(date) || { hours: 0, projectIds: new Set() };
            cur.hours = (0, payroll_calc_1.round2)(cur.hours + Number(d.hours));
            if (l.kind === 'project' && l.projectId != null)
                cur.projectIds.add(l.projectId);
            mine.set(date, cur);
            out.set(l.employeeId, mine);
        }
    }
    return out;
}
let WeeklyTimesheetsService = class WeeklyTimesheetsService {
    constructor(sheets, lines, employees, projects, leaveRequests, holidays, runs, payslips, users, leave, logged, setup, access) {
        this.sheets = sheets;
        this.lines = lines;
        this.employees = employees;
        this.projects = projects;
        this.leaveRequests = leaveRequests;
        this.holidays = holidays;
        this.runs = runs;
        this.payslips = payslips;
        this.users = users;
        this.leave = leave;
        this.logged = logged;
        this.setup = setup;
        this.access = access;
    }
    async me(actor) {
        if (!actor.id)
            return null;
        const linked = await this.employees.findOneBy({ userId: actor.id });
        if (linked)
            return linked;
        const user = await this.users.findOneBy({ id: actor.id });
        const email = user?.email?.trim().toLowerCase();
        if (!email)
            return null;
        const matches = (await this.employees.find()).filter((e) => !e.userId && (e.email || '').trim().toLowerCase() === email);
        if (matches.length !== 1)
            return null;
        matches[0].userId = actor.id;
        return this.employees.save(matches[0]);
    }
    async rights(actor, emp) {
        const hr = await this.access.can(actor, manpower_access_service_1.HR_MODULE);
        const self = !!actor.id && emp.userId === actor.id;
        const boss = emp.supervisorId ? await this.employees.findOneBy({ id: emp.supervisorId }) : null;
        const manager = !!actor.id && !!boss?.userId && boss.userId === actor.id;
        return { hr, self, manager, view: hr || self || manager, edit: hr || self, review: (hr || manager) && !self };
    }
    async employee(id) {
        const e = await this.employees.findOneBy({ id });
        if (!e)
            throw new common_1.NotFoundException('Employee not found');
        return e;
    }
    async load(id) {
        const s = await this.sheets.findOneBy({ id });
        if (!s)
            throw new common_1.NotFoundException('Timesheet not found');
        return s;
    }
    async week(employeeId, weekStart, actor) {
        if (!ISO.test(weekStart || ''))
            throw new common_1.BadRequestException('Which week?');
        const emp = await this.employee(employeeId);
        const r = await this.rights(actor, emp);
        if (!r.view)
            throw new common_1.ForbiddenException("You can only see your own timesheets, or your team's.");
        const start = (0, exports.mondayOf)(weekStart);
        const dates = (0, exports.weekDates)(start);
        const end = dates[6];
        const sheet = await this.sheets.findOneBy({ employeeId, weekStart: start });
        const lines = sheet ? (await this.lines.find({ where: { timesheetId: sheet.id } })).sort((a, b) => a.order - b.order) : [];
        const own = new Set(lines.flatMap((l) => l.leaveRequestIds || []));
        const [s, holidays, leave, logged] = await Promise.all([
            this.setup.settings(),
            this.holidays.find(),
            this.leave.findRequests({ employeeId, from: start, to: end }),
            this.logged.forEmployee(employeeId, start, end),
        ]);
        return {
            employee: { id: emp.id, name: emp.name, workerId: emp.workerId, payType: emp.payType, designation: emp.designation },
            weekStart: start, dates, sheet, lines,
            holidays: holidays.filter((h) => h.date >= start && h.date <= end),
            otherLeave: leave.filter((l) => !own.has(l.id) && ['pending', 'approved'].includes(l.status)),
            logged: logged.rows,
            standardDayHours: s.standardDayHours, halfDayHours: s.halfDayHours, weekendDays: s.weekendDays,
            canEdit: r.edit && (!sheet || ['draft', 'rejected'].includes(sheet.status)),
            canReview: r.review && sheet?.status === 'submitted' && sheet.submittedById !== actor.id,
            canReopen: r.hr && !!sheet && ['submitted', 'approved'].includes(sheet.status),
        };
    }
    async list(opts, actor) {
        let rows = await this.sheets.find({ order: { weekStart: 'DESC' } });
        if (opts.from)
            rows = rows.filter((s) => (0, calendar_util_1.addDays)(s.weekStart, 6) >= opts.from);
        if (opts.to)
            rows = rows.filter((s) => s.weekStart <= opts.to);
        if (opts.status)
            rows = rows.filter((s) => s.status === opts.status);
        if (opts.employeeId)
            rows = rows.filter((s) => s.employeeId === opts.employeeId);
        if (!(await this.access.can(actor, manpower_access_service_1.HR_MODULE))) {
            const mine = actor.id ? await this.employees.findOneBy({ userId: actor.id }) : null;
            const team = mine ? new Set([mine.id, ...(await this.employees.find()).filter((e) => e.supervisorId === mine.id).map((e) => e.id)]) : new Set();
            rows = rows.filter((s) => team.has(s.employeeId));
        }
        if (!rows.length)
            return [];
        const lines = await this.lines.find({ where: { timesheetId: (0, typeorm_2.In)(rows.map((s) => s.id)) } });
        return rows.map((s) => ({ ...s, lines: lines.filter((l) => l.timesheetId === s.id).sort((a, b) => a.order - b.order) }));
    }
    async save(dto, actor) {
        const emp = await this.employee(dto.employeeId);
        const r = await this.rights(actor, emp);
        if (!r.edit)
            throw new common_1.ForbiddenException('You can only fill in your own timesheet.');
        if (emp.contractorId)
            throw new common_1.BadRequestException(`${emp.name} is a contractor's worker -- their time is kept in the daily log.`);
        if (workforce_util_1.LEFT_STATUSES.includes((0, workforce_util_1.lifecycleStatus)(emp)))
            throw new common_1.BadRequestException(`${emp.name} no longer works here.`);
        if (!ISO.test(dto.weekStart || ''))
            throw new common_1.BadRequestException('Which week?');
        const start = (0, exports.mondayOf)(dto.weekStart);
        const dates = new Set((0, exports.weekDates)(start));
        let sheet = await this.sheets.findOneBy({ employeeId: emp.id, weekStart: start });
        if (sheet && !['draft', 'rejected'].includes(sheet.status))
            throw new common_1.BadRequestException(`This timesheet is ${sheet.status} -- it can't be changed now.`);
        const old = sheet ? await this.lines.find({ where: { timesheetId: sheet.id } }) : [];
        const projectIds = new Set((await this.projects.find()).map((p) => Number(p.id)));
        const perDay = new Map();
        const now = new Date().toISOString();
        sheet = sheet || this.sheets.create({ id: (0, workforce_util_1.newId)('TS'), employeeId: emp.id, weekStart: start, status: 'draft', createdAt: now });
        const rows = (dto.lines || []).map((l, i) => {
            if (!exports.TIMESHEET_KINDS.includes(l.kind))
                throw new common_1.BadRequestException('Each row is project work, internal work or leave.');
            if (l.kind === 'project' && !(l.projectId != null && projectIds.has(Number(l.projectId))))
                throw new common_1.BadRequestException(`Row ${i + 1}: pick the project.`);
            if (l.kind === 'internal' && !exports.INTERNAL_CATEGORIES.includes(l.category || ''))
                throw new common_1.BadRequestException(`Row ${i + 1}: pick what kind of internal work.`);
            if (l.kind === 'leave' && !l.leaveTypeId)
                throw new common_1.BadRequestException(`Row ${i + 1}: pick the type of leave.`);
            const days = {};
            for (const [date, d] of Object.entries(l.days || {})) {
                if (!dates.has(date))
                    throw new common_1.BadRequestException(`${date} isn't in this week.`);
                const raw = d?.hours === '' || d?.hours == null ? 0 : Number(d.hours);
                if (!Number.isFinite(raw) || raw < 0 || raw > 24)
                    throw new common_1.BadRequestException(`Hours on ${date} must be between 0 and 24.`);
                const hours = Math.round(raw * 4) / 4;
                const note = d?.note?.trim() || undefined;
                if (!hours && !note)
                    continue;
                days[date] = note ? { hours, note } : { hours };
                perDay.set(date, (perDay.get(date) || 0) + hours);
            }
            const prior = l.id ? old.find((o) => o.id === l.id) : undefined;
            return this.lines.create({
                id: prior?.id || (0, workforce_util_1.newId)('TL'), timesheetId: sheet.id, employeeId: emp.id, kind: l.kind,
                projectId: l.kind === 'project' ? Number(l.projectId) : undefined, csiCodeId: l.kind === 'project' ? l.csiCodeId || undefined : undefined,
                category: l.kind === 'internal' ? l.category : undefined, leaveTypeId: l.kind === 'leave' ? l.leaveTypeId : undefined,
                description: l.description?.trim() || undefined, days, leaveRequestIds: prior?.leaveRequestIds || [], order: i,
            });
        });
        const over = Array.from(perDay.entries()).find(([, h]) => h > 24);
        if (over)
            throw new common_1.BadRequestException(`${over[1]} hours on ${over[0]} -- a day has 24.`);
        Object.assign(sheet, {
            status: 'draft', notes: dto.notes?.trim() || undefined, updatedAt: now,
            totalHours: (0, payroll_calc_1.round2)(rows.reduce((a, l) => a + Object.values(l.days).reduce((b, d) => b + d.hours, 0), 0)),
        });
        const saved = sheet;
        await this.sheets.manager.transaction(async (m) => {
            await m.getRepository(entities_1.TimesheetEntity).save(saved);
            const gone = old.filter((o) => !rows.some((n) => n.id === o.id));
            if (gone.length)
                await m.getRepository(entities_1.TimesheetLineEntity).remove(gone);
            if (rows.length)
                await m.getRepository(entities_1.TimesheetLineEntity).save(rows);
        });
        return this.week(emp.id, start, actor);
    }
    async remove(id, actor) {
        const s = await this.load(id);
        const r = await this.rights(actor, await this.employee(s.employeeId));
        if (!r.edit)
            throw new common_1.ForbiddenException('Not your timesheet.');
        if (!['draft', 'rejected'].includes(s.status))
            throw new common_1.BadRequestException('Only a draft can be deleted.');
        const lines = await this.lines.find({ where: { timesheetId: id } });
        if (lines.some((l) => (l.leaveRequestIds || []).length))
            throw new common_1.BadRequestException('This sheet has leave booked -- clear the leave rows instead.');
        await this.sheets.manager.transaction(async (m) => {
            if (lines.length)
                await m.getRepository(entities_1.TimesheetLineEntity).remove(lines);
            await m.getRepository(entities_1.TimesheetEntity).remove(s);
        });
        return { id, deleted: true };
    }
    async submit(id, actor) {
        const s = await this.load(id);
        const emp = await this.employee(s.employeeId);
        const r = await this.rights(actor, emp);
        if (!r.edit)
            throw new common_1.ForbiddenException('Not your timesheet.');
        if (s.status !== 'draft')
            throw new common_1.BadRequestException(`This timesheet is already ${s.status}.`);
        const lines = await this.lines.find({ where: { timesheetId: id } });
        if (!(s.totalHours > 0))
            throw new common_1.BadRequestException('Enter some hours before submitting.');
        const { weekendDays, halfDayHours } = await this.setup.settings();
        const hol = new Set((await this.holidays.find()).map((h) => h.date));
        const created = [];
        try {
            for (const l of lines.filter((x) => x.kind === 'leave' && !(x.leaveRequestIds || []).length)) {
                const dates = Object.entries(l.days).filter(([, d]) => d.hours > 0).map(([d]) => d).sort();
                const blocks = [];
                for (const d of dates) {
                    const last = blocks[blocks.length - 1];
                    if (last && (0, calendar_util_1.workingDays)((0, calendar_util_1.addDays)(last[last.length - 1], 1), (0, calendar_util_1.addDays)(d, -1), weekendDays, hol).length === 0)
                        last.push(d);
                    else
                        blocks.push([d]);
                }
                const ids = [];
                for (const b of blocks) {
                    const half = b.length === 1 && l.days[b[0]].hours <= halfDayHours;
                    const req = await this.leave.createRequest({
                        employeeId: emp.id, leaveTypeId: l.leaveTypeId, startDate: b[0], endDate: b[b.length - 1], halfDay: half,
                        reason: l.description || 'Entered on timesheet',
                    }, actor);
                    ids.push(req.id);
                    created.push(req.id);
                }
                l.leaveRequestIds = ids;
            }
        }
        catch (err) {
            if (created.length)
                await this.leaveRequests.delete({ id: (0, typeorm_2.In)(created) });
            throw err;
        }
        const now = new Date().toISOString();
        Object.assign(s, { status: 'submitted', submittedAt: now, submittedById: actor.id, submittedByName: actor.name, decidedAt: null, decidedById: null, decidedByName: null, updatedAt: now });
        await this.sheets.manager.transaction(async (m) => {
            await m.getRepository(entities_1.TimesheetLineEntity).save(lines);
            await m.getRepository(entities_1.TimesheetEntity).save(s);
        });
        return s;
    }
    async linkedLeave(sheetId) {
        const lines = await this.lines.find({ where: { timesheetId: sheetId } });
        const ids = lines.flatMap((l) => l.leaveRequestIds || []);
        return { lines, leave: ids.length ? await this.leaveRequests.find({ where: { id: (0, typeorm_2.In)(ids) } }) : [] };
    }
    async approve(id, note, actor) {
        const s = await this.load(id);
        const emp = await this.employee(s.employeeId);
        const r = await this.rights(actor, emp);
        if (s.status !== 'submitted')
            throw new common_1.BadRequestException(`This timesheet is ${s.status}.`);
        if (r.self)
            throw new common_1.ForbiddenException("You can't approve your own timesheet.");
        if (!r.review)
            throw new common_1.ForbiddenException('Only HR or their reporting manager can approve this.');
        if (actor.id && actor.id === s.submittedById)
            throw new common_1.ForbiddenException('You submitted this -- someone else has to approve it.');
        const { leave } = await this.linkedLeave(id);
        const pending = leave.filter((l) => l.status === 'pending');
        if (pending.length && !r.hr)
            throw new common_1.ForbiddenException('This timesheet includes leave -- HR has to approve it.');
        for (const l of pending)
            await this.leave.decide(l.id, 'approved', note || 'Approved with timesheet', actor);
        Object.assign(s, { status: 'approved', decidedAt: new Date().toISOString(), decidedById: actor.id, decidedByName: actor.name, decisionNote: note?.trim() || null, updatedAt: new Date().toISOString() });
        return this.sheets.save(s);
    }
    async reject(id, note, actor) {
        const s = await this.load(id);
        const emp = await this.employee(s.employeeId);
        const r = await this.rights(actor, emp);
        if (s.status !== 'submitted')
            throw new common_1.BadRequestException(`This timesheet is ${s.status}.`);
        if (!r.review)
            throw new common_1.ForbiddenException('Only HR or their reporting manager can send this back.');
        if (!note?.trim())
            throw new common_1.BadRequestException('Say what needs fixing.');
        await this.withdrawLeave(id, actor, 'Timesheet sent back');
        Object.assign(s, { status: 'rejected', decidedAt: new Date().toISOString(), decidedById: actor.id, decidedByName: actor.name, decisionNote: note.trim(), updatedAt: new Date().toISOString() });
        return this.sheets.save(s);
    }
    async reopen(id, reason, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'reopen timesheets');
        const s = await this.load(id);
        if (!['submitted', 'approved'].includes(s.status))
            throw new common_1.BadRequestException('Only a submitted or approved timesheet can be reopened.');
        if (!reason?.trim())
            throw new common_1.BadRequestException('Say why it is being reopened.');
        const end = (0, calendar_util_1.addDays)(s.weekStart, 6);
        const locked = (await this.runs.find({ where: { status: 'finalized' } })).filter((run) => run.periodStart <= end && run.periodEnd >= s.weekStart);
        if (locked.length && (await this.payslips.count({ where: { runId: (0, typeorm_2.In)(locked.map((x) => x.id)), employeeId: s.employeeId } }))) {
            throw new common_1.BadRequestException(`These hours were paid in "${locked[0].label}" -- void that run before changing them.`);
        }
        await this.withdrawLeave(id, actor, 'Timesheet reopened');
        Object.assign(s, { status: 'draft', decisionNote: `Reopened by ${actor.name}: ${reason.trim()}`, decidedAt: null, decidedById: null, decidedByName: null, updatedAt: new Date().toISOString() });
        return this.sheets.save(s);
    }
    async withdrawLeave(sheetId, actor, why) {
        const { lines, leave } = await this.linkedLeave(sheetId);
        const today = new Date().toISOString().slice(0, 10);
        const drop = leave.filter((l) => l.status === 'pending' || (l.status === 'approved' && l.startDate > today));
        if (!drop.length)
            return;
        const now = new Date().toISOString();
        for (const l of drop)
            Object.assign(l, { status: 'cancelled', decidedBy: actor.name, decidedById: actor.id, decidedAt: now, note: why });
        const gone = new Set(drop.map((l) => l.id));
        for (const line of lines)
            line.leaveRequestIds = (line.leaveRequestIds || []).filter((x) => !gone.has(x));
        await this.sheets.manager.transaction(async (m) => {
            await m.getRepository(entities_1.LeaveRequestEntity).save(drop);
            await m.getRepository(entities_1.TimesheetLineEntity).save(lines);
        });
    }
};
exports.WeeklyTimesheetsService = WeeklyTimesheetsService;
exports.WeeklyTimesheetsService = WeeklyTimesheetsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.TimesheetEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.TimesheetLineEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.LeaveRequestEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.PublicHolidayEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.PayrollRunEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.PayslipEntity)),
    __param(8, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        leave_service_1.LeaveService,
        timesheets_service_1.TimesheetsService,
        payroll_setup_service_1.PayrollSetupService,
        manpower_access_service_1.ManpowerAccess])
], WeeklyTimesheetsService);
//# sourceMappingURL=weekly-timesheets.service.js.map