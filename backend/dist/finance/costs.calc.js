"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AGING_BUCKETS = exports.burdened = exports.NO_CODE = void 0;
exports.hourlyRate = hourlyRate;
exports.laborLines = laborLines;
exports.computeJobCost = computeJobCost;
exports.profitability = profitability;
exports.agingBucket = agingBucket;
const money_1 = require("./money");
exports.NO_CODE = 'none';
const keyOf = (csiCodeId) => csiCodeId || exports.NO_CODE;
function hourlyRate(p, s) {
    const rate = Number(p.payRate) || 0;
    if (p.payType === 'hourly')
        return rate;
    if (p.payType === 'daily')
        return rate / s.standardDayHours;
    return rate / (s.monthDays * s.standardDayHours);
}
function laborLines(facts, people, s) {
    const groups = new Map();
    for (const f of facts) {
        if (!(f.hours > 0))
            continue;
        const k = `${f.employeeId}|${f.projectId}|${f.date}`;
        (groups.get(k) || groups.set(k, []).get(k)).push(f);
    }
    const chosen = [];
    for (const g of groups.values()) {
        const ts = g.filter((f) => f.source === 'timesheet');
        const dl = g.filter((f) => f.source === 'daily_log');
        const sum = (xs) => xs.reduce((a, f) => a + f.hours, 0);
        chosen.push(...(sum(dl) > sum(ts) ? dl : ts));
    }
    const dayTotal = new Map();
    for (const f of chosen)
        dayTotal.set(`${f.employeeId}|${f.date}`, (dayTotal.get(`${f.employeeId}|${f.date}`) || 0) + f.hours);
    return chosen.map((f) => {
        const p = people.get(f.employeeId) || { id: f.employeeId, name: 'Unknown worker' };
        const total = dayTotal.get(`${f.employeeId}|${f.date}`) || f.hours;
        const otShare = total > s.standardDayHours ? (total - s.standardDayHours) / total : 0;
        const otHours = f.hours * otShare;
        const base = hourlyRate(p, s);
        const otBase = Number(p.overtimeRate) || base;
        const wage = (f.hours - otHours) * base + otHours * otBase * s.otMultiplier;
        return {
            employeeId: f.employeeId, name: p.name, projectId: f.projectId, date: f.date, csiCodeId: f.csiCodeId, hours: f.hours,
            otHours: Math.round(otHours * 100) / 100, wageC: Math.round(wage * 100), source: f.source, rate: Math.round(base * 100) / 100,
        };
    });
}
const burdened = (wageC, burdenPct) => wageC + (0, money_1.pctOf)(wageC, burdenPct || 0);
exports.burdened = burdened;
function computeJobCost(i) {
    const rows = new Map();
    const row = (csiCodeId) => {
        const key = keyOf(csiCodeId);
        if (!rows.has(key))
            rows.set(key, {
                key, csiCodeId: csiCodeId || null, budgetOriginalC: 0, budgetChangesC: 0, budgetC: 0, committedC: 0, commitmentBilledC: 0, openC: 0,
                billsC: 0, laborC: 0, laborHours: 0, reimbursableC: 0, actualC: 0, eacC: 0, eacOverridden: false, costToCompleteC: 0, varianceC: 0, spentPct: 0,
            });
        return rows.get(key);
    };
    for (const b of i.budgetLines)
        row(b.csiCodeId).budgetOriginalC += b.amountC;
    for (const c of i.coCosts)
        row(c.csiCodeId).budgetChangesC += c.amountC;
    for (const e of i.costEntries)
        row(e.csiCodeId).billsC += e.amountC;
    for (const l of i.labor) {
        const r = row(l.csiCodeId);
        r.laborC += l.costC;
        r.laborHours += l.hours;
    }
    for (const x of i.reimbursables)
        row(x.csiCodeId).reimbursableC += x.costC;
    for (const c of i.commitments) {
        if (c.status !== 'approved' && c.status !== 'closed')
            continue;
        const byCode = new Map();
        for (const l of c.lines) {
            row(l.csiCodeId).committedC += l.amountC;
            byCode.set(keyOf(l.csiCodeId), (byCode.get(keyOf(l.csiCodeId)) || 0) + l.amountC);
        }
        const billedByCode = new Map();
        for (const e of i.costEntries.filter((x) => x.commitmentId === c.id))
            billedByCode.set(keyOf(e.csiCodeId), (billedByCode.get(keyOf(e.csiCodeId)) || 0) + e.amountC);
        for (const [k, amt] of byCode) {
            const r = rows.get(k);
            const billed = billedByCode.get(k) || 0;
            r.commitmentBilledC += billed;
            if (c.status === 'approved')
                r.openC += Math.max(amt - billed, 0);
        }
    }
    for (const [k] of i.forecasts)
        row(k === exports.NO_CODE ? null : k);
    for (const r of rows.values()) {
        r.budgetC = r.budgetOriginalC + r.budgetChangesC;
        r.actualC = r.billsC + r.laborC + r.reimbursableC;
        const override = i.forecasts.get(r.key);
        r.eacOverridden = override != null;
        r.eacC = override != null ? override : Math.max(r.budgetC, r.actualC + r.openC);
        r.costToCompleteC = r.eacC - r.actualC;
        r.varianceC = r.budgetC - r.eacC;
        r.spentPct = r.budgetC > 0 ? (0, money_1.roundPct)((r.actualC / r.budgetC) * 100) : 0;
        r.laborHours = Math.round(r.laborHours * 100) / 100;
    }
    const list = Array.from(rows.values());
    const s = (k) => (0, money_1.sumCents)(list.map((r) => Number(r[k]) || 0));
    const totals = {
        budgetOriginalC: s('budgetOriginalC'), budgetChangesC: s('budgetChangesC'), budgetC: s('budgetC'), committedC: s('committedC'),
        commitmentBilledC: s('commitmentBilledC'), openC: s('openC'), billsC: s('billsC'), laborC: s('laborC'), laborHours: Math.round(list.reduce((a, r) => a + r.laborHours, 0) * 100) / 100,
        reimbursableC: s('reimbursableC'), actualC: s('actualC'), eacC: s('eacC'), costToCompleteC: s('costToCompleteC'), varianceC: s('varianceC'),
    };
    return { rows: list, totals };
}
function profitability(p) {
    const contractCostActualC = p.actualC - p.reimbursableCostC;
    const contractCostEacC = p.eacC - p.reimbursableCostC;
    const projectedMarginC = p.contractC - contractCostEacC;
    const pctComplete = contractCostEacC > 0 ? Math.min(contractCostActualC / contractCostEacC, 1) : 0;
    const earnedRevenueC = Math.round(p.contractC * pctComplete);
    return {
        contractC: p.contractC, projectedCostC: contractCostEacC, projectedMarginC,
        projectedMarginPct: p.contractC ? (0, money_1.roundPct)((projectedMarginC / p.contractC) * 100) : 0,
        costToDateC: contractCostActualC, evC: p.evC, marginToDateC: p.evC - contractCostActualC,
        marginToDatePct: p.evC ? (0, money_1.roundPct)(((p.evC - contractCostActualC) / p.evC) * 100) : 0,
        costCompletePct: (0, money_1.roundPct)(pctComplete * 100), earnedRevenueC, billedC: p.contractWorkInvoicedC,
        overUnderBillingC: p.contractWorkInvoicedC - earnedRevenueC,
        reimbursablesBilledC: p.reimbursablesBilledC, reimbursableCostC: p.reimbursableCostC, reimbursableMarginC: p.reimbursablesBilledC - p.reimbursableCostC,
        loss: projectedMarginC < 0,
    };
}
exports.AGING_BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'];
function agingBucket(dueDate, asOf) {
    if (!dueDate)
        return { bucket: 'current', daysPastDue: 0 };
    const days = Math.floor((Date.parse(asOf + 'T00:00:00Z') - Date.parse(dueDate + 'T00:00:00Z')) / 86400000);
    const bucket = days <= 0 ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd90_plus';
    return { bucket, daysPastDue: Math.max(days, 0) };
}
//# sourceMappingURL=costs.calc.js.map