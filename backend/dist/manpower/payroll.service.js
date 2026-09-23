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
exports.PayrollService = exports.onPayroll = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const calendar_util_1 = require("./calendar.util");
const manpower_access_service_1 = require("./manpower-access.service");
const payroll_setup_service_1 = require("./payroll-setup.service");
const payroll_calc_1 = require("./payroll.calc");
const advances_service_1 = require("./advances.service");
const workforce_util_1 = require("./workforce.util");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const onPayroll = (e, group) => !e.contractorId && (Number(e.payRate) || 0) > 0 && !workforce_util_1.LEFT_STATUSES.includes((0, workforce_util_1.lifecycleStatus)(e))
    && (group === 'all' || (0, payroll_calc_1.payGroupOf)(e) === group);
exports.onPayroll = onPayroll;
const snapshot = (e) => ({
    name: e.name, workerId: e.workerId, designation: e.designation || e.jobTitle, department: e.department, trade: e.trade,
    employmentType: e.employmentType, payType: e.payType || 'monthly', payRate: e.payRate, overtimeRate: e.overtimeRate,
    hireDate: e.hireDate, bankName: e.bankName, bankAccount: e.bankAccount, taxNumber: e.taxNumber, payComponents: e.payComponents || [],
});
let PayrollService = class PayrollService {
    constructor(runs, slips, employees, logs, entries, overtime, advances, components, setup, access, leaveRequests, leaveTypes, leaveAdjustments, holidays, shiftAssignments, shiftTemplates) {
        this.runs = runs;
        this.slips = slips;
        this.employees = employees;
        this.logs = logs;
        this.entries = entries;
        this.overtime = overtime;
        this.advances = advances;
        this.components = components;
        this.setup = setup;
        this.access = access;
        this.leaveRequests = leaveRequests;
        this.leaveTypes = leaveTypes;
        this.leaveAdjustments = leaveAdjustments;
        this.holidays = holidays;
        this.shiftAssignments = shiftAssignments;
        this.shiftTemplates = shiftTemplates;
    }
    listRuns() {
        return this.runs.find({ order: { periodStart: 'DESC' } });
    }
    async getRun(id) {
        const run = await this.loadRun(id);
        const slips = await this.slips.find({ where: { runId: id } });
        slips.sort((a, b) => String(a.employee?.name || '').localeCompare(String(b.employee?.name || '')));
        return { ...run, payslips: slips };
    }
    async employeePayslips(employeeId) {
        const slips = await this.slips.find({ where: { employeeId } });
        if (!slips.length)
            return [];
        const runs = await this.runs.find({ where: { id: (0, typeorm_2.In)(Array.from(new Set(slips.map((s) => s.runId)))) } });
        const byId = new Map(runs.map((r) => [r.id, r]));
        return slips
            .map((s) => ({ ...s, run: byId.get(s.runId) }))
            .filter((s) => s.run && s.run.status !== 'void')
            .sort((a, b) => b.run.periodStart.localeCompare(a.run.periodStart));
    }
    async loadRun(id) {
        const run = await this.runs.findOneBy({ id });
        if (!run)
            throw new common_1.NotFoundException('Payroll run not found');
        return run;
    }
    async sources(people, periodStart, periodEnd) {
        const employeeIds = people.map((e) => e.id);
        const dayHours = new Map();
        const logs = await this.logs.createQueryBuilder('l')
            .where('l.status = :st', { st: 'approved' })
            .andWhere('l.date >= :a AND l.date <= :b', { a: periodStart, b: periodEnd })
            .getMany();
        const logDate = new Map(logs.map((l) => [l.id, l.date]));
        const wanted = new Set(employeeIds);
        for (let i = 0; i < logs.length; i += 1000) {
            const chunk = logs.slice(i, i + 1000).map((l) => l.id);
            for (const e of await this.entries.find({ where: { dailyLogId: (0, typeorm_2.In)(chunk) } })) {
                if (!wanted.has(e.employeeId))
                    continue;
                const m = dayHours.get(e.employeeId) || {};
                const date = logDate.get(e.dailyLogId);
                m[date] = (0, payroll_calc_1.round2)((m[date] || 0) + (Number(e.hours) || 0));
                dayHours.set(e.employeeId, m);
            }
        }
        const overtime = new Map();
        const ots = await this.overtime.createQueryBuilder('o')
            .where('o.status = :st', { st: 'approved' })
            .andWhere('o.payrollRunId IS NULL')
            .andWhere('o.date <= :b', { b: periodEnd })
            .getMany();
        for (const o of ots)
            if (wanted.has(o.employeeId))
                overtime.set(o.employeeId, [...(overtime.get(o.employeeId) || []), o]);
        const recoveries = new Map();
        const advs = await this.advances.createQueryBuilder('a')
            .where('a.status = :st', { st: 'disbursed' })
            .andWhere('a.deductionStart <= :b', { b: periodEnd })
            .orderBy('a.deductionStart', 'ASC')
            .getMany();
        for (const a of advs) {
            if (!wanted.has(a.employeeId) || (0, advances_service_1.remainingOf)(a) <= 0)
                continue;
            recoveries.set(a.employeeId, [...(recoveries.get(a.employeeId) || []), {
                    id: a.id, type: a.type, label: payroll_calc_1.ADVANCE_LABEL[a.type] || 'Advance', remaining: (0, advances_service_1.remainingOf)(a), installmentAmount: a.installmentAmount,
                }]);
        }
        const s = await this.setup.settings();
        const hol = new Set((await this.holidays.find()).map((h) => h.date));
        const paidType = new Map((await this.leaveTypes.find()).map((t) => [t.id, t.paid]));
        const leave = new Map();
        const leaveDates = new Map();
        for (const r of await this.leaveRequests.find({ where: { status: 'approved' } })) {
            if (!wanted.has(r.employeeId))
                continue;
            const span = (0, calendar_util_1.overlap)(r.startDate, r.endDate, periodStart, periodEnd);
            if (!span)
                continue;
            const dates = (0, calendar_util_1.workingDays)(span[0], span[1], s.weekendDays, hol);
            const n = r.halfDay ? Math.min(dates.length, 0.5) : dates.length;
            const cur = leave.get(r.employeeId) || { paidDays: 0, unpaidDays: 0 };
            if (paidType.get(r.leaveTypeId) === false)
                cur.unpaidDays = (0, payroll_calc_1.round2)(cur.unpaidDays + n);
            else
                cur.paidDays = (0, payroll_calc_1.round2)(cur.paidDays + n);
            leave.set(r.employeeId, cur);
            if (!r.halfDay) {
                const set = leaveDates.get(r.employeeId) || new Set();
                dates.forEach((d) => set.add(d));
                leaveDates.set(r.employeeId, set);
            }
        }
        const templates = new Map((await this.shiftTemplates.find()).map((t) => [t.id, t]));
        const assigns = (await this.shiftAssignments.find()).filter((a) => wanted.has(a.employeeId) && a.startDate <= periodEnd && (!a.endDate || a.endDate >= periodStart));
        const shiftAllowances = new Map();
        for (const e of people) {
            const mine = assigns.filter((a) => a.employeeId === e.id);
            if (!mine.length)
                continue;
            const worked = (0, payroll_calc_1.payGroupOf)(e) === 'daily'
                ? Object.entries(dayHours.get(e.id) || {}).filter(([, h]) => h > 0).map(([d]) => d)
                : (0, calendar_util_1.workingDays)(e.hireDate && e.hireDate > periodStart ? e.hireDate : periodStart, periodEnd, s.weekendDays, hol).filter((d) => !leaveDates.get(e.id)?.has(d));
            const tally = new Map();
            for (const d of worked) {
                const tid = mine.map((a) => (0, calendar_util_1.shiftOn)(a, d)).find(Boolean);
                const t = tid ? templates.get(tid) : undefined;
                if (t && (t.allowancePerDay || 0) > 0)
                    tally.set(t.id, (tally.get(t.id) || 0) + 1);
            }
            if (tally.size)
                shiftAllowances.set(e.id, Array.from(tally.entries()).map(([tid, days]) => ({ templateId: tid, name: templates.get(tid).name, days, rate: templates.get(tid).allowancePerDay })));
        }
        const encashments = new Map();
        for (const a of await this.leaveAdjustments.find({ where: { kind: 'encashment' } })) {
            if (!wanted.has(a.employeeId) || a.payrollRunId || !(a.amount > 0) || a.createdAt.slice(0, 10) > periodEnd)
                continue;
            encashments.set(a.employeeId, [...(encashments.get(a.employeeId) || []), { id: a.id, days: (0, payroll_calc_1.round2)(-a.days), amount: a.amount }]);
        }
        return { dayHours, overtime, recoveries, leave, shiftAllowances, encashments };
    }
    compute(e, run, s, components, src, keep) {
        const work = keep?.work?.manual ? keep.work : (0, payroll_calc_1.workFromLogs)(src.dayHours.get(e.id) || {}, s);
        return (0, payroll_calc_1.calculatePayslip)({
            employee: e, settings: s, components, periodStart: run.periodStart, periodEnd: run.periodEnd, work,
            overtime: (src.overtime.get(e.id) || []).map((o) => ({ id: o.id, hours: o.hours, amount: o.amount })),
            recoveries: src.recoveries.get(e.id) || [],
            manualLines: keep?.manualLines || [],
            leave: src.leave?.get(e.id),
            shiftAllowances: src.shiftAllowances?.get(e.id),
            encashments: src.encashments?.get(e.id),
        });
    }
    totals(slips) {
        return {
            headcount: slips.length,
            gross: (0, payroll_calc_1.round2)(slips.reduce((a, x) => a + x.gross, 0)),
            deductions: (0, payroll_calc_1.round2)(slips.reduce((a, x) => a + x.deductions, 0)),
            net: (0, payroll_calc_1.round2)(slips.reduce((a, x) => a + x.net, 0)),
            paid: (0, payroll_calc_1.round2)(slips.filter((x) => x.paymentStatus === 'paid').reduce((a, x) => a + x.net, 0)),
        };
    }
    async createRun(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'prepare payroll');
        if (!ISO.test(dto.periodStart || '') || !ISO.test(dto.periodEnd || ''))
            throw new common_1.BadRequestException('Give the pay period start and end dates.');
        if (dto.periodEnd < dto.periodStart)
            throw new common_1.BadRequestException('The period ends before it starts.');
        const payGroup = ['monthly', 'daily'].includes(dto.payGroup || '') ? dto.payGroup : 'all';
        const clash = (await this.runs.find()).find((r) => r.status !== 'void'
            && r.periodStart <= dto.periodEnd && r.periodEnd >= dto.periodStart
            && (payGroup === 'all' || r.payGroup === 'all' || r.payGroup === payGroup));
        if (clash)
            throw new common_1.BadRequestException(`"${clash.label}" already covers part of this period for these employees.`);
        const everyone = (await this.employees.find()).filter((e) => (0, exports.onPayroll)(e, payGroup));
        if (!everyone.length)
            throw new common_1.BadRequestException('Nobody to pay: no active employees with a pay rate in this group.');
        const [s, components] = await Promise.all([this.setup.settings(), this.components.find()]);
        const src = await this.sources(everyone, dto.periodStart, dto.periodEnd);
        const now = new Date().toISOString();
        const label = dto.label?.trim() || new Date(dto.periodStart + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
            + (payGroup === 'all' ? '' : payGroup === 'monthly' ? ' — salaried' : ' — daily wage');
        const run = this.runs.create({
            id: (0, workforce_util_1.newId)('PR'), label, periodStart: dto.periodStart, periodEnd: dto.periodEnd, payGroup, status: 'draft',
            settingsSnapshot: s, notes: dto.notes, createdByName: actor.name, createdAt: now, updatedAt: now,
        });
        const slips = everyone.map((e) => {
            const r = this.compute(e, run, s, components, src);
            return this.slips.create({ id: (0, workforce_util_1.newId)('PS'), runId: run.id, employeeId: e.id, employee: snapshot(e), ...r, paymentStatus: 'unpaid', updatedAt: now });
        });
        run.totals = this.totals(slips);
        await this.runs.manager.transaction(async (m) => {
            await m.getRepository(entities_1.PayrollRunEntity).save(run);
            await m.getRepository(entities_1.PayslipEntity).save(slips);
        });
        return this.getRun(run.id);
    }
    async requireDraft(runId) {
        const run = await this.loadRun(runId);
        if (run.status !== 'draft')
            throw new common_1.BadRequestException(`This run is ${run.status} -- it can no longer be changed.`);
        return run;
    }
    async recalculate(runId, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'prepare payroll');
        const run = await this.requireDraft(runId);
        const slips = await this.slips.find({ where: { runId } });
        const byEmp = new Map(slips.map((x) => [x.employeeId, x]));
        const everyone = (await this.employees.find()).filter((e) => (0, exports.onPayroll)(e, run.payGroup) || byEmp.has(e.id));
        const [s, components] = await Promise.all([this.setup.settings(), this.components.find()]);
        const src = await this.sources(everyone.filter((e) => (0, exports.onPayroll)(e, run.payGroup)), run.periodStart, run.periodEnd);
        const now = new Date().toISOString();
        const next = everyone.filter((e) => (0, exports.onPayroll)(e, run.payGroup)).map((e) => {
            const old = byEmp.get(e.id);
            const keep = old ? { work: old.basis, manualLines: old.lines.filter((l) => l.source === 'manual') } : undefined;
            const r = this.compute(e, run, s, components, src, keep);
            return this.slips.create({ ...(old || {}), id: old?.id || (0, workforce_util_1.newId)('PS'), runId, employeeId: e.id, employee: snapshot(e), ...r, paymentStatus: 'unpaid', updatedAt: now });
        });
        const dropped = slips.filter((x) => !next.some((n) => n.id === x.id));
        Object.assign(run, { totals: this.totals(next), settingsSnapshot: s, updatedAt: now });
        await this.runs.manager.transaction(async (m) => {
            if (dropped.length)
                await m.getRepository(entities_1.PayslipEntity).remove(dropped);
            await m.getRepository(entities_1.PayslipEntity).save(next);
            await m.getRepository(entities_1.PayrollRunEntity).save(run);
        });
        return this.getRun(runId);
    }
    async updatePayslip(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'edit payslips');
        const slip = await this.slips.findOneBy({ id });
        if (!slip)
            throw new common_1.NotFoundException('Payslip not found');
        const run = await this.requireDraft(slip.runId);
        const emp = await this.employees.findOneBy({ id: slip.employeeId });
        if (!emp)
            throw new common_1.BadRequestException('The employee no longer exists -- recalculate the run.');
        let work = slip.basis;
        if (dto.work === null)
            work = undefined;
        else if (dto.work) {
            const num = (v, name) => {
                const n = Number(v ?? 0);
                if (!Number.isFinite(n) || n < 0)
                    throw new common_1.BadRequestException(`${name} can't be negative.`);
                return (0, payroll_calc_1.round2)(n);
            };
            const w = { ...slip.basis, ...dto.work };
            const fullDays = num(w.fullDays, 'Full days');
            const halfDays = num(w.halfDays, 'Half days');
            const extraHours = num(w.extraHours, 'Hours');
            const hoursWorked = num(w.hoursWorked, 'Hours worked');
            work = { fullDays, halfDays, extraHours, hoursWorked, manual: true };
        }
        let manualLines = slip.lines.filter((l) => l.source === 'manual');
        if (dto.manualLines) {
            manualLines = dto.manualLines.map((l) => {
                const amount = (0, payroll_calc_1.round2)(Number(l.amount));
                if (!l.name?.trim())
                    throw new common_1.BadRequestException('Name each adjustment.');
                if (!(amount > 0))
                    throw new common_1.BadRequestException('Adjustment amounts must be above 0 -- choose earning or deduction for the direction.');
                if (!['earning', 'deduction'].includes(l.kind))
                    throw new common_1.BadRequestException('An adjustment is an earning or a deduction.');
                return { id: l.id || (0, workforce_util_1.newId)('ML'), name: l.name.trim(), kind: l.kind, source: 'manual', amount, note: l.note };
            });
        }
        const [s, components] = await Promise.all([this.setup.settings(), this.components.find()]);
        const src = await this.sources([emp], run.periodStart, run.periodEnd);
        const r = this.compute(emp, run, s, components, src, { work, manualLines });
        Object.assign(slip, r, { employee: snapshot(emp), notes: dto.notes ?? slip.notes, updatedAt: new Date().toISOString() });
        await this.slips.save(slip);
        run.totals = this.totals(await this.slips.find({ where: { runId: run.id } }));
        await this.runs.save(run);
        return slip;
    }
    async removeRun(id, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'delete payroll drafts');
        const run = await this.requireDraft(id);
        await this.runs.manager.transaction(async (m) => {
            await m.getRepository(entities_1.PayslipEntity).delete({ runId: id });
            await m.getRepository(entities_1.PayrollRunEntity).remove(run);
        });
        return { id, deleted: true };
    }
    async finalize(id, actor) {
        await this.access.require(actor, manpower_access_service_1.FINANCE_MODULE, 'finalize payroll');
        const run = await this.requireDraft(id);
        const slips = await this.slips.find({ where: { runId: id } });
        if (!slips.length)
            throw new common_1.BadRequestException('This run has no payslips.');
        return this.runs.manager.transaction(async (m) => {
            const otRepo = m.getRepository(entities_1.OvertimeRequestEntity);
            const advRepo = m.getRepository(entities_1.EmployeeAdvanceEntity);
            const otIds = slips.flatMap((x) => x.lines.filter((l) => l.source === 'overtime').flatMap((l) => l.refIds || []));
            const ots = otIds.length ? await otRepo.findBy({ id: (0, typeorm_2.In)(otIds) }) : [];
            const problems = [];
            for (const oid of otIds) {
                const o = ots.find((x) => x.id === oid);
                if (!o || o.status !== 'approved' || o.payrollRunId)
                    problems.push('some overtime was cancelled or already paid');
            }
            const recoveryLines = slips.flatMap((x) => x.lines.filter((l) => l.source === 'advance' || l.source === 'loan').map((l) => ({ slip: x, line: l })));
            const advIds = recoveryLines.map((r) => r.line.refIds?.[0]).filter(Boolean);
            const advs = advIds.length ? await advRepo.findBy({ id: (0, typeorm_2.In)(advIds) }) : [];
            const owed = new Map(advs.map((a) => [a.id, a.status === 'disbursed' ? (0, advances_service_1.remainingOf)(a) : 0]));
            for (const { line } of recoveryLines) {
                const aid = line.refIds?.[0] || '';
                const left = owed.get(aid) ?? 0;
                if (line.amount > left + 0.005)
                    problems.push('an advance or loan balance changed');
                owed.set(aid, (0, payroll_calc_1.round2)(left - line.amount));
            }
            const encRepo = m.getRepository(entities_1.LeaveAdjustmentEntity);
            const encIds = slips.flatMap((x) => x.lines.filter((l) => l.source === 'encashment').flatMap((l) => l.refIds || []));
            const encs = encIds.length ? await encRepo.findBy({ id: (0, typeorm_2.In)(encIds) }) : [];
            for (const eid of encIds) {
                const a = encs.find((x) => x.id === eid);
                if (!a || a.payrollRunId)
                    problems.push('a leave encashment was removed or already paid');
            }
            if (problems.length)
                throw new common_1.BadRequestException(`Figures changed since this run was calculated (${Array.from(new Set(problems)).join('; ')}). Recalculate it, check it, then finalize.`);
            if (ots.length) {
                for (const o of ots)
                    Object.assign(o, { payrollRunId: id, updatedAt: new Date().toISOString() });
                await otRepo.save(ots);
            }
            if (encs.length) {
                for (const a of encs)
                    a.payrollRunId = id;
                await encRepo.save(encs);
            }
            for (const a of advs) {
                const mine = recoveryLines.filter((r) => r.line.refIds?.[0] === a.id);
                const total = (0, payroll_calc_1.round2)(mine.reduce((s2, r) => s2 + r.line.amount, 0));
                a.repayments = [...(a.repayments || []), ...mine.map((r) => ({
                        id: (0, workforce_util_1.newId)('RP'), date: run.periodEnd, amount: r.line.amount, method: 'payroll', runId: id, payslipId: r.slip.id, byName: actor.name,
                    }))];
                a.recovered = (0, payroll_calc_1.round2)((a.recovered || 0) + total);
                if ((0, advances_service_1.remainingOf)(a) <= 0.005)
                    a.status = 'settled';
                a.updatedAt = new Date().toISOString();
            }
            if (advs.length)
                await advRepo.save(advs);
            Object.assign(run, { status: 'finalized', finalizedByName: actor.name, finalizedAt: new Date().toISOString(), totals: this.totals(slips), updatedAt: new Date().toISOString() });
            await m.getRepository(entities_1.PayrollRunEntity).save(run);
            return { ...run, payslips: slips };
        });
    }
    async voidRun(id, reason, actor) {
        await this.access.require(actor, manpower_access_service_1.FINANCE_MODULE, 'void payroll');
        const run = await this.loadRun(id);
        if (run.status !== 'finalized')
            throw new common_1.BadRequestException(run.status === 'draft' ? 'Delete a draft instead of voiding it.' : 'This run is already void.');
        if (!reason?.trim())
            throw new common_1.BadRequestException('Say why this run is being voided.');
        const slips = await this.slips.find({ where: { runId: id } });
        if (slips.some((x) => x.paymentStatus === 'paid'))
            throw new common_1.BadRequestException('Payments have been recorded against this run -- it can no longer be voided.');
        return this.runs.manager.transaction(async (m) => {
            const otRepo = m.getRepository(entities_1.OvertimeRequestEntity);
            const ots = await otRepo.find({ where: { payrollRunId: id } });
            for (const o of ots)
                Object.assign(o, { payrollRunId: null, updatedAt: new Date().toISOString() });
            if (ots.length)
                await otRepo.save(ots);
            const encRepo = m.getRepository(entities_1.LeaveAdjustmentEntity);
            const encs = await encRepo.find({ where: { payrollRunId: id } });
            for (const a of encs)
                a.payrollRunId = null;
            if (encs.length)
                await encRepo.save(encs);
            const advRepo = m.getRepository(entities_1.EmployeeAdvanceEntity);
            const touched = (await advRepo.find()).filter((a) => (a.repayments || []).some((r) => r.runId === id));
            for (const a of touched) {
                const undo = (0, payroll_calc_1.round2)(a.repayments.filter((r) => r.runId === id).reduce((s2, r) => s2 + r.amount, 0));
                a.repayments = a.repayments.filter((r) => r.runId !== id);
                a.recovered = (0, payroll_calc_1.round2)(Math.max(0, (a.recovered || 0) - undo));
                if (a.status === 'settled' && (0, advances_service_1.remainingOf)(a) > 0.005)
                    a.status = 'disbursed';
                a.updatedAt = new Date().toISOString();
            }
            if (touched.length)
                await advRepo.save(touched);
            Object.assign(run, { status: 'void', voidedByName: actor.name, voidedAt: new Date().toISOString(), voidReason: reason.trim(), updatedAt: new Date().toISOString() });
            return m.getRepository(entities_1.PayrollRunEntity).save(run);
        });
    }
    async markPaid(runId, payslipIds, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.FINANCE_MODULE, 'record salary payments');
        const run = await this.loadRun(runId);
        if (run.status !== 'finalized')
            throw new common_1.BadRequestException('Finalize the run before recording payments.');
        const slips = await this.slips.find({ where: { runId } });
        const target = slips.filter((x) => x.paymentStatus !== 'paid' && (payslipIds === 'all' || payslipIds.includes(x.id)));
        if (!target.length)
            throw new common_1.BadRequestException('Nothing left unpaid in that selection.');
        const date = dto.date || (0, workforce_util_1.todayISO)();
        for (const x of target)
            Object.assign(x, { paymentStatus: 'paid', paidAt: date, paymentMethod: dto.method || 'bank_transfer', paymentRef: dto.ref, paidByName: actor.name, updatedAt: new Date().toISOString() });
        await this.slips.save(target);
        run.totals = this.totals(slips);
        run.updatedAt = new Date().toISOString();
        await this.runs.save(run);
        return this.getRun(runId);
    }
};
exports.PayrollService = PayrollService;
exports.PayrollService = PayrollService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.PayrollRunEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.PayslipEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.DailyLogEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.LaborLogEntryEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.OvertimeRequestEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.EmployeeAdvanceEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.PayComponentEntity)),
    __param(10, (0, typeorm_1.InjectRepository)(entities_1.LeaveRequestEntity)),
    __param(11, (0, typeorm_1.InjectRepository)(entities_1.LeaveTypeEntity)),
    __param(12, (0, typeorm_1.InjectRepository)(entities_1.LeaveAdjustmentEntity)),
    __param(13, (0, typeorm_1.InjectRepository)(entities_1.PublicHolidayEntity)),
    __param(14, (0, typeorm_1.InjectRepository)(entities_1.ShiftAssignmentEntity)),
    __param(15, (0, typeorm_1.InjectRepository)(entities_1.ShiftTemplateEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        payroll_setup_service_1.PayrollSetupService,
        manpower_access_service_1.ManpowerAccess,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], PayrollService);
//# sourceMappingURL=payroll.service.js.map