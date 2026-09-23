"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADVANCE_LABEL = exports.daysInclusive = exports.overtimeBase = exports.payGroupOf = exports.round2 = exports.LEGACY_PAYROLL_SETTINGS = exports.DEFAULT_PAYROLL_SETTINGS = void 0;
exports.hourlyBase = hourlyBase;
exports.workFromLogs = workFromLogs;
exports.calculatePayslip = calculatePayslip;
exports.DEFAULT_PAYROLL_SETTINGS = {
    currency: 'USD',
    standardDayHours: 8,
    halfDayHours: 4,
    monthDays: 21.67,
    otMultipliers: { normal: 1.5, weekend: 1.5, holiday: 2, night: 1.1 },
    weekendDays: [0, 6],
};
exports.LEGACY_PAYROLL_SETTINGS = {
    currency: 'PKR', standardDayHours: 8, halfDayHours: 4, monthDays: 30,
    otMultipliers: { normal: 1.5, weekend: 2, holiday: 2, night: 1.25 }, weekendDays: [0],
};
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
exports.round2 = round2;
const payGroupOf = (e) => e.payType === 'daily' || e.payType === 'hourly' ? 'daily' : 'monthly';
exports.payGroupOf = payGroupOf;
function hourlyBase(e, s) {
    const rate = Number(e.payRate) || 0;
    if (e.payType === 'hourly')
        return rate;
    if (e.payType === 'daily')
        return rate / s.standardDayHours;
    return rate / (s.monthDays * s.standardDayHours);
}
const overtimeBase = (e, s) => Number(e.overtimeRate) || hourlyBase(e, s);
exports.overtimeBase = overtimeBase;
const daysInclusive = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;
exports.daysInclusive = daysInclusive;
function workFromLogs(dayHours, s) {
    let fullDays = 0, halfDays = 0, extraHours = 0, hoursWorked = 0;
    for (const h of Object.values(dayHours)) {
        if (!(h > 0))
            continue;
        hoursWorked += h;
        if (h >= s.standardDayHours)
            fullDays += 1;
        else if (h >= s.halfDayHours)
            halfDays += 1;
        else
            extraHours += h;
    }
    return { fullDays, halfDays, extraHours: (0, exports.round2)(extraHours), hoursWorked: (0, exports.round2)(hoursWorked), manual: false };
}
function calculatePayslip(i) {
    const s = i.settings;
    const e = i.employee;
    const group = (0, exports.payGroupOf)(e);
    const rate = Number(e.payRate) || 0;
    const hourly = hourlyBase(e, s);
    let n = 0;
    const id = () => 'PL' + ++n;
    const earnings = [];
    const deductions = [];
    const basis = { payGroup: group, payType: e.payType || 'monthly', rate, hourlyRate: (0, exports.round2)(hourly), ...i.work };
    let basic = 0;
    if (group === 'monthly') {
        const periodDays = (0, exports.daysInclusive)(i.periodStart, i.periodEnd);
        const from = e.hireDate && e.hireDate > i.periodStart ? e.hireDate : i.periodStart;
        const employedDays = from > i.periodEnd ? 0 : (0, exports.daysInclusive)(from, i.periodEnd);
        basic = (0, exports.round2)(rate * (employedDays / periodDays));
        Object.assign(basis, { periodDays, employedDays });
        earnings.push({
            id: id(), name: 'Basic salary', kind: 'earning', source: 'basic', amount: basic,
            note: employedDays < periodDays ? `Prorated: joined mid-period, ${employedDays} of ${periodDays} days` : undefined,
        });
    }
    else if (e.payType === 'hourly') {
        basic = (0, exports.round2)(i.work.hoursWorked * rate);
        if (basic)
            earnings.push({ id: id(), name: `Hours worked — ${i.work.hoursWorked} h × ${rate}`, kind: 'earning', source: 'wages', amount: basic });
    }
    else {
        const full = (0, exports.round2)(i.work.fullDays * rate);
        const half = (0, exports.round2)(i.work.halfDays * rate / 2);
        const loose = (0, exports.round2)(i.work.extraHours * hourly);
        if (full)
            earnings.push({ id: id(), name: `Daily wage — ${i.work.fullDays} full day${i.work.fullDays === 1 ? '' : 's'} × ${rate}`, kind: 'earning', source: 'wages', amount: full });
        if (half)
            earnings.push({ id: id(), name: `Half days — ${i.work.halfDays} × ${(0, exports.round2)(rate / 2)}`, kind: 'earning', source: 'wages', amount: half });
        if (loose)
            earnings.push({ id: id(), name: `Short days — ${i.work.extraHours} h × ${(0, exports.round2)(hourly)}`, kind: 'earning', source: 'wages', amount: loose });
        basic = (0, exports.round2)(full + half + loose);
    }
    const paidLeave = i.leave?.paidDays || 0;
    if (group === 'daily' && paidLeave > 0) {
        const perDay = e.payType === 'hourly' ? rate * s.standardDayHours : rate;
        const amount = (0, exports.round2)(paidLeave * perDay);
        earnings.push({ id: id(), name: `Paid leave — ${paidLeave} day${paidLeave === 1 ? '' : 's'} × ${(0, exports.round2)(perDay)}`, kind: 'earning', source: 'leave', amount });
        basic = (0, exports.round2)(basic + amount);
    }
    basis.basic = basic;
    if (i.leave)
        Object.assign(basis, { paidLeaveDays: i.leave.paidDays, unpaidLeaveDays: i.leave.unpaidDays });
    if (i.overtime.length) {
        const hours = (0, exports.round2)(i.overtime.reduce((a, o) => a + o.hours, 0));
        const amount = (0, exports.round2)(i.overtime.reduce((a, o) => a + (o.amount || 0), 0));
        basis.otHours = hours;
        earnings.push({ id: id(), name: `Overtime — ${hours} h approved`, kind: 'earning', source: 'overtime', amount, refIds: i.overtime.map((o) => o.id) });
    }
    for (const sh of i.shiftAllowances || []) {
        const amount = (0, exports.round2)(sh.days * sh.rate);
        if (amount)
            earnings.push({ id: id(), name: `${sh.name} allowance — ${sh.days} day${sh.days === 1 ? '' : 's'} × ${sh.rate}`, kind: 'earning', source: 'shift', amount });
    }
    if (i.encashments?.length) {
        const days = (0, exports.round2)(i.encashments.reduce((a, x) => a + x.days, 0));
        const amount = (0, exports.round2)(i.encashments.reduce((a, x) => a + x.amount, 0));
        earnings.push({ id: id(), name: `Leave encashment — ${days} day${days === 1 ? '' : 's'}`, kind: 'earning', source: 'encashment', amount, refIds: i.encashments.map((x) => x.id) });
    }
    const own = new Map((e.payComponents || []).map((c) => [c.componentId, Number(c.value)]));
    const applicable = i.components
        .filter((c) => c.active && (c.appliesTo === 'all' || c.appliesTo === group))
        .filter((c) => own.has(c.id) || (Number(c.defaultValue) || 0) > 0)
        .sort((a, b) => a.order - b.order);
    const valueOf = (c) => (own.has(c.id) ? own.get(c.id) : Number(c.defaultValue) || 0);
    const pct = (c) => `${valueOf(c)}%`;
    for (const c of applicable.filter((x) => x.kind === 'earning')) {
        const amount = (0, exports.round2)(c.calcType === 'fixed' ? valueOf(c) : basic * valueOf(c) / 100);
        if (amount)
            earnings.push({ id: id(), name: c.calcType === 'fixed' ? c.name : `${c.name} (${pct(c)} of basic)`, kind: 'earning', source: 'component', componentId: c.id, amount });
    }
    for (const m of i.manualLines.filter((l) => l.kind === 'earning'))
        earnings.push({ ...m, source: 'manual' });
    const gross = (0, exports.round2)(earnings.reduce((a, l) => a + l.amount, 0));
    const unpaid = i.leave?.unpaidDays || 0;
    if (group === 'monthly' && unpaid > 0) {
        const perDay = rate / s.monthDays;
        const amount = (0, exports.round2)(Math.min(unpaid * perDay, basic));
        if (amount)
            deductions.push({ id: id(), name: `Unpaid leave — ${unpaid} day${unpaid === 1 ? '' : 's'} × ${(0, exports.round2)(perDay)}`, kind: 'deduction', source: 'leave', amount });
    }
    for (const c of applicable.filter((x) => x.kind === 'deduction')) {
        const base = c.calcType === 'percent_gross' ? gross : basic;
        const amount = (0, exports.round2)(c.calcType === 'fixed' ? valueOf(c) : base * valueOf(c) / 100);
        if (amount)
            deductions.push({ id: id(), name: c.calcType === 'fixed' ? c.name : `${c.name} (${pct(c)} of ${c.calcType === 'percent_gross' ? 'gross' : 'basic'})`, kind: 'deduction', source: 'component', componentId: c.id, amount });
    }
    for (const m of i.manualLines.filter((l) => l.kind === 'deduction'))
        deductions.push({ ...m, source: 'manual' });
    let available = (0, exports.round2)(gross - deductions.reduce((a, l) => a + l.amount, 0));
    for (const r of i.recoveries) {
        const due = (0, exports.round2)(Math.min(r.installmentAmount, r.remaining));
        const take = (0, exports.round2)(Math.max(0, Math.min(due, available)));
        if (take <= 0) {
            if (due > 0)
                basis.recoveryShortfall = true;
            continue;
        }
        available = (0, exports.round2)(available - take);
        deductions.push({
            id: id(), name: `${r.label} recovery`, kind: 'deduction', source: r.type === 'loan' ? 'loan' : 'advance', amount: take, refIds: [r.id],
            note: take < due ? `Reduced from ${due} so net pay doesn't go negative` : undefined,
        });
    }
    const totalDeductions = (0, exports.round2)(deductions.reduce((a, l) => a + l.amount, 0));
    return { basis, lines: [...earnings, ...deductions], gross, deductions: totalDeductions, net: (0, exports.round2)(gross - totalDeductions) };
}
exports.ADVANCE_LABEL = {
    salary_advance: 'Salary advance',
    emergency_advance: 'Emergency advance',
    loan: 'Employee loan',
    travel_advance: 'Travel advance',
    project_advance: 'Project advance',
};
//# sourceMappingURL=payroll.calc.js.map