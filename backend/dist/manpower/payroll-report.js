"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payrollReport = payrollReport;
const cents = (n) => Math.round((Number(n) || 0) * 100);
const dollars = (c) => Math.round(c) / 100;
function earningKey(l) {
    if (l.source === 'basic' || l.source === 'wages')
        return 'Regular pay';
    if (l.source === 'overtime')
        return 'Overtime';
    if (l.source === 'component')
        return l.name || 'Allowance';
    return l.name || 'Other earnings';
}
function deductionKind(l, comps) {
    const c = l.componentId ? comps.get(l.componentId) : undefined;
    if (c?.category === 'tax' || c?.category === 'social_security')
        return 'tax';
    if (!c && /withholding|income tax|social security|medicare|fica|\bsdi\b|state tax|federal tax/i.test(l.name || ''))
        return 'tax';
    return 'other';
}
function deductionKey(l) {
    if (l.source === 'advance')
        return 'Advance repayment';
    if (l.source === 'loan')
        return 'Loan repayment';
    return l.name || 'Other deduction';
}
function payrollReport(runs, slips, components, opts) {
    const comps = new Map(components.map((c) => [c.id, c]));
    const inRange = runs
        .filter((r) => r.status === 'finalized' || (opts.includeDrafts && r.status === 'draft'))
        .filter((r) => (r.periodEnd || '') >= opts.from && (r.periodEnd || '') <= opts.to)
        .sort((a, b) => (a.periodEnd || '').localeCompare(b.periodEnd || ''));
    const runIds = new Set(inRange.map((r) => r.id));
    const mine = slips.filter((s) => runIds.has(s.runId) && (!opts.employeeId || s.employeeId === opts.employeeId));
    const cols = { earnings: new Set(), taxes: new Set(), deductions: new Set() };
    const blank = (key, label, sub) => ({ key, label, sub, payslips: 0, earnings: new Map(), gross: 0, taxes: new Map(), deductions: new Map(), net: 0, paid: 0, unpaid: 0 });
    const add = (m, k, c) => m.set(k, (m.get(k) || 0) + c);
    const byEmp = new Map();
    const byRun = new Map(inRange.map((r) => [r.id, blank(r.id, r.label, `${r.periodStart} – ${r.periodEnd}${r.status === 'draft' ? ' (draft)' : ''}`)]));
    const total = blank('total', 'Total');
    for (const s of mine) {
        const emp = s.employee;
        if (!byEmp.has(s.employeeId))
            byEmp.set(s.employeeId, blank(s.employeeId, String(emp?.name || s.employeeId), [emp?.workerId, emp?.department].filter(Boolean).join(' · ') || undefined));
        for (const acc of [byEmp.get(s.employeeId), byRun.get(s.runId), total]) {
            acc.payslips += 1;
            for (const l of s.lines || []) {
                const c = cents(l.amount);
                if (l.kind === 'earning') {
                    const k = earningKey(l);
                    cols.earnings.add(k);
                    add(acc.earnings, k, c);
                }
                else if (deductionKind(l, comps) === 'tax') {
                    const k = l.name || 'Tax';
                    cols.taxes.add(k);
                    add(acc.taxes, k, c);
                }
                else {
                    const k = deductionKey(l);
                    cols.deductions.add(k);
                    add(acc.deductions, k, c);
                }
            }
            acc.gross += cents(s.gross);
            acc.net += cents(s.net);
            if (s.paymentStatus === 'paid')
                acc.paid += cents(s.net);
            else
                acc.unpaid += cents(s.net);
        }
    }
    const out = (a) => {
        const obj = (m) => Object.fromEntries([...m].map(([k, v]) => [k, dollars(v)]));
        const sum = (m) => dollars([...m.values()].reduce((x, y) => x + y, 0));
        return {
            key: a.key, label: a.label, ...(a.sub ? { sub: a.sub } : {}), payslips: a.payslips,
            earnings: obj(a.earnings), gross: dollars(a.gross),
            taxes: obj(a.taxes), taxTotal: sum(a.taxes),
            deductions: obj(a.deductions), deductionTotal: sum(a.deductions),
            net: dollars(a.net), paid: dollars(a.paid), unpaid: dollars(a.unpaid),
        };
    };
    const order = (first) => (s) => [...first.filter((x) => s.has(x)), ...[...s].filter((x) => !first.includes(x)).sort()];
    return {
        from: opts.from, to: opts.to, includeDrafts: !!opts.includeDrafts,
        runs: inRange.map((r) => ({ id: r.id, label: r.label, periodStart: r.periodStart, periodEnd: r.periodEnd, status: r.status, headcount: mine.filter((s) => s.runId === r.id).length })),
        columns: {
            earnings: order(['Regular pay', 'Overtime'])(cols.earnings),
            taxes: order(['Federal income tax withholding', 'Social Security', 'Medicare'])(cols.taxes),
            deductions: order([])(cols.deductions),
        },
        byEmployee: [...byEmp.values()].map(out).sort((a, b) => a.label.localeCompare(b.label)),
        byRun: [...byRun.values()].map(out),
        totals: out(total),
    };
}
//# sourceMappingURL=payroll-report.js.map