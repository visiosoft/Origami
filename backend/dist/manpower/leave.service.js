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
exports.LeaveService = exports.DEFAULT_LEAVE_TYPES = void 0;
exports.usFederalHolidays = usFederalHolidays;
exports.requestDaysInYear = requestDaysInYear;
exports.entitlementFor = entitlementFor;
exports.computeBalance = computeBalance;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("./manpower-access.service");
const payroll_setup_service_1 = require("./payroll-setup.service");
const calendar_util_1 = require("./calendar.util");
const payroll_calc_1 = require("./payroll.calc");
const workforce_util_1 = require("./workforce.util");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
exports.DEFAULT_LEAVE_TYPES = [
    { id: 'LT-ANNUAL', name: 'Vacation (PTO)', paid: true, trackBalance: true, annualDays: 10, carryForwardMax: 5, encashable: true, color: '#2F7D4A', active: true },
    { id: 'LT-CASUAL', name: 'Personal', paid: true, trackBalance: true, annualDays: 3, carryForwardMax: 0, encashable: false, color: '#3C5C8A', active: true },
    { id: 'LT-SICK', name: 'Sick', paid: true, trackBalance: true, annualDays: 5, carryForwardMax: 0, encashable: false, color: '#B4532A', active: true },
    { id: 'LT-EMERGENCY', name: 'Emergency', paid: true, trackBalance: true, annualDays: 3, carryForwardMax: 0, encashable: false, color: '#8A6D12', active: true },
    { id: 'LT-MATERNITY', name: 'Maternity', paid: true, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#7A4FA0', active: true },
    { id: 'LT-PATERNITY', name: 'Paternity', paid: true, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#5B6CB0', active: true },
    { id: 'LT-BEREAVEMENT', name: 'Bereavement', paid: true, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#5C6B65', active: true },
    { id: 'LT-UNPAID', name: 'Unpaid', paid: false, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#9AA39D', active: true },
    { id: 'LT-FMLA', name: 'FMLA', paid: false, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#6B4FA0', active: true },
    { id: 'LT-JURY', name: 'Jury duty', paid: true, trackBalance: false, annualDays: 0, carryForwardMax: 0, encashable: false, color: '#1F8A72', active: true },
];
const LEGACY_LEAVE = {
    'LT-ANNUAL': { name: 'Annual', annualDays: 14, carryForwardMax: 7 },
    'LT-CASUAL': { name: 'Casual', annualDays: 10, carryForwardMax: 0 },
    'LT-SICK': { name: 'Sick', annualDays: 8, carryForwardMax: 0 },
};
function nthWeekday(year, month, dow, n) {
    if (n > 0) {
        const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
        return new Date(Date.UTC(year, month, 1 + ((dow - first + 7) % 7) + (n - 1) * 7)).toISOString().slice(0, 10);
    }
    const last = new Date(Date.UTC(year, month + 1, 0));
    return new Date(Date.UTC(year, month, last.getUTCDate() - ((last.getUTCDay() - dow + 7) % 7))).toISOString().slice(0, 10);
}
function observed(date) {
    const d = new Date(date + 'T00:00:00Z');
    const shift = d.getUTCDay() === 6 ? -1 : d.getUTCDay() === 0 ? 1 : 0;
    return new Date(d.getTime() + shift * 86400000).toISOString().slice(0, 10);
}
function usFederalHolidays(year) {
    return [
        { date: observed(`${year}-01-01`), name: "New Year's Day" },
        { date: nthWeekday(year, 0, 1, 3), name: 'Martin Luther King Jr. Day' },
        { date: nthWeekday(year, 1, 1, 3), name: "Washington's Birthday (Presidents' Day)" },
        { date: nthWeekday(year, 4, 1, -1), name: 'Memorial Day' },
        { date: observed(`${year}-06-19`), name: 'Juneteenth' },
        { date: observed(`${year}-07-04`), name: 'Independence Day' },
        { date: nthWeekday(year, 8, 1, 1), name: 'Labor Day' },
        { date: nthWeekday(year, 9, 1, 2), name: 'Columbus Day' },
        { date: observed(`${year}-11-11`), name: 'Veterans Day' },
        { date: nthWeekday(year, 10, 4, 4), name: 'Thanksgiving Day' },
        { date: observed(`${year}-12-25`), name: 'Christmas Day' },
    ];
}
const LEGACY_TYPE = { PTO: 'LT-ANNUAL', Sick: 'LT-SICK', Unpaid: 'LT-UNPAID', Other: 'LT-CASUAL' };
function requestDaysInYear(r, year, weekendDays, holidays) {
    const span = (0, calendar_util_1.overlap)(r.startDate, r.endDate, `${year}-01-01`, `${year}-12-31`);
    if (!span)
        return 0;
    const n = (0, calendar_util_1.workingDays)(span[0], span[1], weekendDays, holidays).length;
    return r.halfDay ? Math.min(n, 0.5) : n;
}
function entitlementFor(type, hireDate, year) {
    if (!type.trackBalance)
        return 0;
    if (!hireDate || (0, calendar_util_1.yearOf)(hireDate) < year)
        return type.annualDays;
    if ((0, calendar_util_1.yearOf)(hireDate) > year)
        return 0;
    const monthsLeft = 12 - Number(hireDate.slice(5, 7)) + 1;
    return Math.round((type.annualDays * monthsLeft) / 12 * 2) / 2;
}
function computeBalance(type, hireDate, year, requests, adjustments, weekendDays, holidays) {
    const mine = requests.filter((r) => r.leaveTypeId === type.id);
    const adj = adjustments.filter((a) => a.leaveTypeId === type.id && a.year === year);
    const sum = (kind) => (0, payroll_calc_1.round2)(adj.filter((a) => a.kind === kind).reduce((s, a) => s + a.days, 0));
    const days = (status) => (0, payroll_calc_1.round2)(mine.filter((r) => r.status === status).reduce((s, r) => s + requestDaysInYear(r, year, weekendDays, holidays), 0));
    const entitlement = entitlementFor(type, hireDate, year);
    const carriedForward = sum('carry_forward');
    const adjusted = sum('manual');
    const encashed = (0, payroll_calc_1.round2)(-sum('encashment'));
    const used = days('approved');
    const pending = days('pending');
    return {
        leaveTypeId: type.id, name: type.name, trackBalance: type.trackBalance, paid: type.paid, encashable: type.encashable,
        entitlement, carriedForward, adjusted, encashed, used, pending,
        available: (0, payroll_calc_1.round2)(entitlement + carriedForward + adjusted - encashed - used),
    };
}
let LeaveService = class LeaveService {
    constructor(types, requests, adjustments, holidays, employees, setup, access) {
        this.types = types;
        this.requests = requests;
        this.adjustments = adjustments;
        this.holidays = holidays;
        this.employees = employees;
        this.setup = setup;
        this.access = access;
        this.log = new common_1.Logger('LeaveService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.types.count()) === 0) {
                await this.types.save(exports.DEFAULT_LEAVE_TYPES.map((t, i) => ({ ...t, order: i })));
                this.log.log(`Seeded ${exports.DEFAULT_LEAVE_TYPES.length} leave types`);
            }
            else {
                await this.convertToUs();
            }
            const legacy = (await this.requests.find()).filter((r) => !r.leaveTypeId);
            if (legacy.length) {
                const { weekendDays } = await this.setup.settings();
                const hol = await this.holidaySet();
                for (const r of legacy) {
                    r.leaveTypeId = LEGACY_TYPE[r.type] || 'LT-CASUAL';
                    if (r.status === 'denied')
                        r.status = 'rejected';
                    r.days = (0, calendar_util_1.workingDays)(r.startDate, r.endDate, weekendDays, hol).length;
                }
                await this.requests.save(legacy);
                this.log.log(`Upgraded ${legacy.length} older leave request(s) to leave types`);
            }
        }
        catch (err) {
            this.log.error('Leave bootstrap failed: ' + err.message);
        }
    }
    async convertToUs() {
        const rows = await this.types.find();
        const changed = [];
        for (const r of rows) {
            const old = LEGACY_LEAVE[r.id];
            if (old && r.name === old.name && r.annualDays === old.annualDays && r.carryForwardMax === old.carryForwardMax) {
                const us = exports.DEFAULT_LEAVE_TYPES.find((t) => t.id === r.id);
                Object.assign(r, { name: us.name, annualDays: us.annualDays, carryForwardMax: us.carryForwardMax });
                changed.push(r);
            }
            if (r.id === 'LT-ROTATION' && r.name === 'Site rotation' && r.active && !(await this.requests.count({ where: { leaveTypeId: r.id } }))) {
                r.active = false;
                changed.push(r);
            }
        }
        let order = rows.length;
        for (const t of exports.DEFAULT_LEAVE_TYPES)
            if (!rows.some((r) => r.id === t.id))
                changed.push(this.types.create({ ...t, order: order++ }));
        if (changed.length) {
            await this.types.save(changed);
            this.log.log(`Leave types set up for the US (${changed.length} changed)`);
        }
    }
    listTypes() {
        return this.types.find({ order: { order: 'ASC' } });
    }
    checkType(t) {
        for (const k of ['annualDays', 'carryForwardMax']) {
            if (t[k] != null && (!Number.isFinite(Number(t[k])) || Number(t[k]) < 0 || Number(t[k]) > 366))
                throw new common_1.BadRequestException('Days must be between 0 and 366.');
        }
    }
    async createType(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change leave types');
        if (!dto.name?.trim())
            throw new common_1.BadRequestException('Name the leave type.');
        this.checkType(dto);
        const row = { paid: true, trackBalance: true, annualDays: 0, carryForwardMax: 0, encashable: false, active: true, order: await this.types.count(), ...dto, name: dto.name.trim(), id: (0, workforce_util_1.newId)('LT') };
        return this.types.save(this.types.create(row));
    }
    async updateType(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change leave types');
        const t = await this.types.findOneBy({ id });
        if (!t)
            throw new common_1.NotFoundException('Leave type not found');
        this.checkType(dto);
        Object.assign(t, dto, { id });
        return this.types.save(t);
    }
    async removeType(id, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change leave types');
        if (await this.requests.count({ where: { leaveTypeId: id } }))
            throw new common_1.BadRequestException('This type has leave on record -- make it inactive instead.');
        const t = await this.types.findOneBy({ id });
        if (t)
            await this.types.remove(t);
        return { id, deleted: true };
    }
    listHolidays(year) {
        return this.holidays.find({ order: { date: 'ASC' } }).then((all) => (year ? all.filter((h) => (0, calendar_util_1.yearOf)(h.date) === year) : all));
    }
    async holidaySet() {
        return new Set((await this.holidays.find()).map((h) => h.date));
    }
    async addHoliday(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change public holidays');
        if (!ISO.test(dto.date || '') || !dto.name?.trim())
            throw new common_1.BadRequestException('Give the holiday a date and a name.');
        if (await this.holidays.findOneBy({ date: dto.date }))
            throw new common_1.BadRequestException('There is already a holiday on that date.');
        return this.holidays.save(this.holidays.create({ id: (0, workforce_util_1.newId)('PH'), date: dto.date, name: dto.name.trim() }));
    }
    async addUsFederalHolidays(year, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change public holidays');
        const y = Number(year);
        if (!Number.isInteger(y) || y < 2000 || y > 2100)
            throw new common_1.BadRequestException('Which year?');
        const taken = new Set((await this.holidays.find()).map((h) => h.date));
        const rows = usFederalHolidays(y).filter((h) => !taken.has(h.date)).map((h) => this.holidays.create({ id: (0, workforce_util_1.newId)('PH'), ...h }));
        if (rows.length)
            await this.holidays.save(rows);
        return { year: y, added: rows.length };
    }
    async removeHoliday(id, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change public holidays');
        const h = await this.holidays.findOneBy({ id });
        if (h)
            await this.holidays.remove(h);
        return { id, deleted: true };
    }
    async context() {
        const [types, s, hol] = await Promise.all([this.types.find({ order: { order: 'ASC' } }), this.setup.settings(), this.holidaySet()]);
        return { types, weekendDays: s.weekendDays, hol };
    }
    async balances(employeeId, year) {
        const emp = await this.employees.findOneBy({ id: employeeId });
        if (!emp)
            throw new common_1.NotFoundException('Employee not found');
        const { types, weekendDays, hol } = await this.context();
        const [reqs, adjs] = await Promise.all([
            this.requests.find({ where: { employeeId } }),
            this.adjustments.find({ where: { employeeId } }),
        ]);
        return types.filter((t) => t.active || reqs.some((r) => r.leaveTypeId === t.id))
            .map((t) => computeBalance(t, emp.hireDate, year, reqs, adjs, weekendDays, hol));
    }
    async allBalances(year) {
        const { types, weekendDays, hol } = await this.context();
        const tracked = types.filter((t) => t.active && t.trackBalance);
        const [emps, reqs, adjs] = await Promise.all([this.employees.find(), this.requests.find(), this.adjustments.find()]);
        return emps.filter((e) => !e.contractorId && !workforce_util_1.LEFT_STATUSES.includes((0, workforce_util_1.lifecycleStatus)(e))).map((e) => ({
            employeeId: e.id,
            balances: tracked.map((t) => computeBalance(t, e.hireDate, year, reqs.filter((r) => r.employeeId === e.id), adjs.filter((a) => a.employeeId === e.id), weekendDays, hol)),
        }));
    }
    async adjust(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'adjust leave balances');
        const days = (0, payroll_calc_1.round2)(Number(dto.days));
        if (!days || Math.abs(days) > 366)
            throw new common_1.BadRequestException('Give a number of days to add (+) or take away (-).');
        if (!dto.note?.trim())
            throw new common_1.BadRequestException('Say why the balance is being adjusted.');
        await this.requireTrackedType(dto.leaveTypeId);
        if (!(await this.employees.findOneBy({ id: dto.employeeId })))
            throw new common_1.BadRequestException('Employee not found.');
        return this.adjustments.save(this.adjustments.create({
            id: (0, workforce_util_1.newId)('LA'), employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year: Number(dto.year), kind: 'manual', days,
            note: dto.note.trim(), createdByName: actor.name, createdAt: new Date().toISOString(),
        }));
    }
    async requireTrackedType(id) {
        const t = await this.types.findOneBy({ id });
        if (!t)
            throw new common_1.BadRequestException('Unknown leave type.');
        if (!t.trackBalance)
            throw new common_1.BadRequestException(`${t.name} leave has no balance to adjust.`);
        return t;
    }
    async encash(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'encash leave');
        const t = await this.requireTrackedType(dto.leaveTypeId);
        if (!t.encashable)
            throw new common_1.BadRequestException(`${t.name} leave can't be encashed.`);
        const emp = await this.employees.findOneBy({ id: dto.employeeId });
        if (!emp)
            throw new common_1.BadRequestException('Employee not found.');
        const days = (0, payroll_calc_1.round2)(Number(dto.days));
        if (!(days > 0))
            throw new common_1.BadRequestException('Encash at least half a day.');
        const bal = (await this.balances(emp.id, Number(dto.year))).find((b) => b.leaveTypeId === t.id);
        if (days > bal.available - bal.pending + 0.001)
            throw new common_1.BadRequestException(`Only ${(0, payroll_calc_1.round2)(bal.available - bal.pending)} day(s) can be encashed.`);
        const s = await this.setup.settings();
        const dayRate = (0, payroll_calc_1.hourlyBase)(emp, s) * s.standardDayHours;
        if (!(dayRate > 0))
            throw new common_1.BadRequestException(`${emp.name} has no pay rate to value the days at.`);
        return this.adjustments.save(this.adjustments.create({
            id: (0, workforce_util_1.newId)('LA'), employeeId: emp.id, leaveTypeId: t.id, year: Number(dto.year), kind: 'encashment', days: -days,
            amount: (0, payroll_calc_1.round2)(days * dayRate), note: `${days} day(s) of ${t.name} at ${(0, payroll_calc_1.round2)(dayRate)}/day`,
            createdByName: actor.name, createdAt: new Date().toISOString(),
        }));
    }
    async carryForward(fromYear, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'carry leave forward');
        const year = Number(fromYear);
        if (!Number.isInteger(year))
            throw new common_1.BadRequestException('Which year is closing?');
        const { types, weekendDays, hol } = await this.context();
        const carrying = types.filter((t) => t.trackBalance && t.carryForwardMax > 0);
        if (!carrying.length)
            throw new common_1.BadRequestException('No leave type allows carry-forward. Set a carry-forward limit first.');
        const [emps, reqs, adjs] = await Promise.all([this.employees.find(), this.requests.find(), this.adjustments.find()]);
        const stale = adjs.filter((a) => a.kind === 'carry_forward' && a.year === year + 1);
        if (stale.length)
            await this.adjustments.remove(stale);
        const fresh = adjs.filter((a) => !stale.includes(a));
        const rows = [];
        for (const e of emps.filter((x) => !x.contractorId && !workforce_util_1.LEFT_STATUSES.includes((0, workforce_util_1.lifecycleStatus)(x)))) {
            for (const t of carrying) {
                const bal = computeBalance(t, e.hireDate, year, reqs.filter((r) => r.employeeId === e.id), fresh.filter((a) => a.employeeId === e.id), weekendDays, hol);
                const carry = (0, payroll_calc_1.round2)(Math.min(Math.max(bal.available, 0), t.carryForwardMax));
                if (carry > 0)
                    rows.push(this.adjustments.create({
                        id: (0, workforce_util_1.newId)('LA'), employeeId: e.id, leaveTypeId: t.id, year: year + 1, kind: 'carry_forward', days: carry,
                        note: `Carried forward from ${year}`, createdByName: actor.name, createdAt: new Date().toISOString(),
                    }));
            }
        }
        if (rows.length)
            await this.adjustments.save(rows);
        return { year: year + 1, carried: rows.length, days: (0, payroll_calc_1.round2)(rows.reduce((s, r) => s + r.days, 0)) };
    }
    listAdjustments(employeeId) {
        return this.adjustments.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
    }
    async findRequests(opts) {
        const where = {};
        if (opts.employeeId)
            where.employeeId = opts.employeeId;
        if (opts.status)
            where.status = opts.status;
        const rows = await this.requests.find({ where, order: { startDate: 'DESC' } });
        return rows.filter((r) => (!opts.from || r.endDate >= opts.from) && (!opts.to || r.startDate <= opts.to));
    }
    async preview(dto) {
        const { days, type, emp } = await this.measure(dto);
        const years = Array.from(new Set([(0, calendar_util_1.yearOf)(dto.startDate), (0, calendar_util_1.yearOf)(dto.endDate)]));
        const balances = type.trackBalance
            ? await Promise.all(years.map(async (y) => ({ year: y, ...(await this.balances(emp.id, y)).find((b) => b.leaveTypeId === type.id) })))
            : [];
        return { days, balances };
    }
    async measure(dto) {
        if (!ISO.test(dto.startDate || '') || !ISO.test(dto.endDate || ''))
            throw new common_1.BadRequestException('Give the first and last day of leave.');
        if (dto.endDate < dto.startDate)
            throw new common_1.BadRequestException('The leave ends before it starts.');
        if (dto.halfDay && dto.startDate !== dto.endDate)
            throw new common_1.BadRequestException('A half day has to be a single day.');
        const emp = await this.employees.findOneBy({ id: dto.employeeId });
        if (!emp)
            throw new common_1.BadRequestException('Employee not found.');
        const type = await this.types.findOneBy({ id: dto.leaveTypeId });
        if (!type || !type.active)
            throw new common_1.BadRequestException('Pick a leave type.');
        const { weekendDays } = await this.setup.settings();
        const n = (0, calendar_util_1.workingDays)(dto.startDate, dto.endDate, weekendDays, await this.holidaySet()).length;
        return { days: dto.halfDay ? Math.min(n, 0.5) : n, type, emp, weekendDays };
    }
    async assertFits(r, type) {
        const others = (await this.requests.find({ where: { employeeId: r.employeeId } }))
            .filter((x) => x.id !== r.id && ['pending', 'approved'].includes(x.status));
        const clash = others.find((x) => (0, calendar_util_1.overlap)(x.startDate, x.endDate, r.startDate, r.endDate));
        if (clash)
            throw new common_1.BadRequestException(`This overlaps leave already booked from ${clash.startDate} to ${clash.endDate}.`);
        if (!type.trackBalance)
            return;
        const { weekendDays, hol } = await this.context();
        for (const y of Array.from(new Set([(0, calendar_util_1.yearOf)(r.startDate), (0, calendar_util_1.yearOf)(r.endDate)]))) {
            const want = requestDaysInYear({ ...r, status: 'pending', halfDay: !!r.halfDay }, y, weekendDays, hol);
            const bal = (await this.balances(r.employeeId, y)).find((b) => b.leaveTypeId === type.id);
            const pendingElsewhere = (0, payroll_calc_1.round2)(others.filter((x) => x.status === 'pending' && x.leaveTypeId === type.id).reduce((s, x) => s + requestDaysInYear(x, y, weekendDays, hol), 0));
            const free = (0, payroll_calc_1.round2)(bal.available - pendingElsewhere);
            if (want > free + 0.001)
                throw new common_1.BadRequestException(`Not enough ${type.name} leave for ${y}: ${want} day(s) asked, ${Math.max(free, 0)} available.`);
        }
    }
    async createRequest(dto, actor) {
        const { days, type, emp } = await this.measure(dto);
        if (emp.contractorId)
            throw new common_1.BadRequestException(`${emp.name} is a contractor's worker -- their leave is managed by the contractor.`);
        if (workforce_util_1.LEFT_STATUSES.includes((0, workforce_util_1.lifecycleStatus)(emp)))
            throw new common_1.BadRequestException(`${emp.name} is no longer employed.`);
        if (!(days > 0))
            throw new common_1.BadRequestException('Those dates are all weekends or public holidays -- no working days to take.');
        await this.assertFits(dto, type);
        const now = new Date().toISOString();
        return this.requests.save(this.requests.create({
            id: (0, workforce_util_1.newId)('LR'), employeeId: emp.id, leaveTypeId: type.id, type: type.name, startDate: dto.startDate, endDate: dto.endDate,
            halfDay: !!dto.halfDay, days, reason: dto.reason, status: 'pending',
            requestedBy: actor.name, requestedById: actor.id, requestedAt: now,
        }));
    }
    async load(id) {
        const r = await this.requests.findOneBy({ id });
        if (!r)
            throw new common_1.NotFoundException('Leave request not found');
        return r;
    }
    async decide(id, decision, note, actor) {
        const r = await this.load(id);
        if (r.status !== 'pending')
            throw new common_1.BadRequestException(`This request is already ${r.status}.`);
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, `${decision === 'approved' ? 'approve' : 'reject'} leave`);
        if (actor.id && actor.id === r.requestedById)
            throw new common_1.ForbiddenException('You raised this request -- someone else has to decide it.');
        const emp = await this.employees.findOneBy({ id: r.employeeId });
        if (actor.id && emp?.userId && emp.userId === actor.id)
            throw new common_1.ForbiddenException("You can't decide your own leave.");
        if (decision === 'approved') {
            const type = await this.types.findOneBy({ id: r.leaveTypeId });
            if (type)
                await this.assertFits(r, type);
        }
        Object.assign(r, { status: decision, decidedBy: actor.name, decidedById: actor.id, decidedAt: new Date().toISOString(), note: note || '' });
        return this.requests.save(r);
    }
    async cancel(id, actor) {
        const r = await this.load(id);
        const future = r.startDate > (0, workforce_util_1.todayISO)();
        if (!(r.status === 'pending' || (r.status === 'approved' && future)))
            throw new common_1.BadRequestException('Only pending leave, or approved leave that has not started, can be cancelled.');
        const own = !!actor.id && actor.id === r.requestedById;
        if (!own && !(await this.access.can(actor, manpower_access_service_1.HR_MODULE)))
            throw new common_1.ForbiddenException('Only the requester or HR can cancel this.');
        Object.assign(r, { status: 'cancelled', decidedBy: actor.name, decidedById: actor.id, decidedAt: new Date().toISOString() });
        return this.requests.save(r);
    }
    async calendar(from, to) {
        if (!ISO.test(from || '') || !ISO.test(to || ''))
            throw new common_1.BadRequestException('Give a date range.');
        const reqs = (await this.requests.find()).filter((r) => ['approved', 'pending'].includes(r.status) && r.endDate >= from && r.startDate <= to);
        const hols = (await this.holidays.find()).filter((h) => h.date >= from && h.date <= to);
        return { requests: reqs, holidays: hols };
    }
};
exports.LeaveService = LeaveService;
exports.LeaveService = LeaveService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.LeaveTypeEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.LeaveRequestEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.LeaveAdjustmentEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.PublicHolidayEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        payroll_setup_service_1.PayrollSetupService,
        manpower_access_service_1.ManpowerAccess])
], LeaveService);
//# sourceMappingURL=leave.service.js.map