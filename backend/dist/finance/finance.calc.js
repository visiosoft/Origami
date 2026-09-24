"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineMath = lineMath;
exports.invoiceTotals = invoiceTotals;
exports.allocatePayments = allocatePayments;
exports.computeSov = computeSov;
exports.toDollars = toDollars;
const money_1 = require("./money");
function lineMath(l) {
    const retentionC = l.kind !== 'adjustment' && l.retentionApplies ? (0, money_1.pctOf)(l.amountC, l.retentionPct) : 0;
    const netC = l.amountC - retentionC;
    const taxC = l.taxable ? (0, money_1.pctOf)(netC, l.taxPct) : 0;
    return { retentionC, netC, taxC };
}
function invoiceTotals(lines) {
    const m = lines.map((l) => ({ l, ...lineMath(l) }));
    const contractWorkC = (0, money_1.sumCents)(m.filter((x) => x.l.kind !== 'adjustment').map((x) => x.l.amountC));
    const adjustmentC = (0, money_1.sumCents)(m.filter((x) => x.l.kind === 'adjustment').map((x) => x.l.amountC));
    const retentionC = (0, money_1.sumCents)(m.map((x) => x.retentionC));
    const taxC = (0, money_1.sumCents)(m.map((x) => x.taxC));
    const totalC = (0, money_1.sumCents)(m.map((x) => x.netC)) + taxC;
    return { contractWorkC, retentionC, adjustmentC, taxC, totalC };
}
function allocatePayments(lines, invoiceTotalC, paidC) {
    const out = new Map();
    const work = lines.filter((l) => l.kind !== 'adjustment');
    const nets = work.map((l) => Math.max(0, l.amountC - l.retentionC));
    const workNetC = (0, money_1.sumCents)(nets);
    if (!work.length || invoiceTotalC <= 0 || paidC <= 0 || workNetC <= 0) {
        work.forEach((l) => out.set(l.id, 0));
        return out;
    }
    const share = Math.min(workNetC, Math.round((paidC * workNetC) / invoiceTotalC));
    (0, money_1.allocate)(share, nets).forEach((c, i) => out.set(work[i].id, c));
    return out;
}
const billable = (f, requireApproval) => (f ? (requireApproval ? Number(f.approvedProgress) : Number(f.reportedProgress)) || 0 : 0);
const valC = (f) => (f && f.contractValue != null ? (0, money_1.toCents)(f.contractValue) : null);
function figures(valueC, evC, invoicedC, retentionC, paidC, p) {
    const billableC = Math.max(evC - invoicedC, 0);
    const overBilledC = Math.max(invoicedC - evC, 0);
    const netC = invoicedC - retentionC;
    const v = valueC ?? 0;
    const progressStatus = p.reported >= 100 ? 'complete' : p.reported > 0 ? 'in_progress' : 'not_started';
    const billingStatus = !v && !invoicedC ? 'not_billable'
        : overBilledC > 0 ? 'over_billed'
            : v > 0 && invoicedC >= v ? 'fully_invoiced'
                : billableC > 0 ? 'ready_to_invoice'
                    : invoicedC > 0 ? 'partially_invoiced' : 'not_invoiced';
    const paymentStatus = netC <= 0 ? 'none' : paidC >= netC ? 'paid' : paidC > 0 ? 'partially_paid' : 'unpaid';
    return {
        valueC, evC, invoicedC, retentionC, paidC, billableC, overBilledC, remainingC: v - invoicedC, outstandingC: Math.max(netC - paidC, 0),
        reportedProgress: (0, money_1.roundPct)(p.reported), approvedProgress: (0, money_1.roundPct)(p.approved), billableProgress: (0, money_1.roundPct)(p.billable), physicalProgress: (0, money_1.roundPct)(p.physical),
        progressStatus, billingStatus, paymentStatus,
    };
}
function addUp(rows) {
    const s = (k) => (0, money_1.sumCents)(rows.map((r) => Number(r[k]) || 0));
    const valueC = rows.some((r) => r.valueC != null) ? s('valueC') : null;
    const evC = s('evC');
    const pct = valueC ? (evC / valueC) * 100 : 0;
    return figures(valueC, evC, s('invoicedC'), s('retentionC'), s('paidC'), { reported: pct, approved: pct, billable: pct, physical: 0 });
}
function computeSov(i) {
    const paidByInvoice = new Map();
    for (const p of i.payments)
        paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) || 0) + p.amountC);
    const linePaid = new Map();
    for (const inv of i.invoices) {
        const mine = i.lines.filter((l) => l.invoiceId === inv.id);
        for (const [id, c] of allocatePayments(mine, inv.totalC, paidByInvoice.get(inv.id) || 0))
            linePaid.set(id, c);
    }
    const billed = (pred) => {
        const ls = i.lines.filter((l) => l.kind !== 'adjustment' && pred(l));
        return { invoicedC: (0, money_1.sumCents)(ls.map((l) => l.amountC)), retentionC: (0, money_1.sumCents)(ls.map((l) => l.retentionC)), paidC: (0, money_1.sumCents)(ls.map((l) => linePaid.get(l.id) || 0)) };
    };
    const liveTasks = i.tasks;
    const taskIds = new Set(liveTasks.map((t) => t.id));
    const taskRow = (t, deleted = false) => {
        const f = i.taskFin.get(t.id);
        const valueC = valC(f);
        const bp = billable(f, i.requireApproval);
        const b = billed((l) => l.taskId === t.id);
        return {
            kind: 'task', id: t.id, name: t.title, phaseId: t.phaseId, ownValueC: valueC, deleted, fin: f || null,
            ...figures(valueC, valueC != null ? (0, money_1.pctOf)(valueC, bp) : 0, b.invoicedC, b.retentionC, b.paidC, { reported: Number(f?.reportedProgress) || 0, approved: Number(f?.approvedProgress) || 0, billable: bp, physical: t.done ? 100 : 0 }),
        };
    };
    const phaseRows = [...i.phases].sort((a, b) => a.order - b.order).map((ph) => {
        const tasks = liveTasks.filter((t) => t.phaseId === ph.id).sort((a, b) => a.order - b.order);
        const children = tasks.map((t) => taskRow(t));
        const f = i.phaseFin.get(ph.id);
        const own = billed((l) => l.phaseId === ph.id && !l.taskId);
        const fromTasks = children.some((c) => c.ownValueC != null);
        const physical = tasks.length ? (tasks.filter((t) => t.done).length / tasks.length) * 100 : 0;
        if (fromTasks) {
            const valued = children.filter((c) => c.ownValueC != null || c.invoicedC);
            const sum = addUp(valued);
            const rowFigs = figures(sum.valueC, sum.evC, sum.invoicedC + own.invoicedC, sum.retentionC + own.retentionC, sum.paidC + own.paidC, { reported: sum.reportedProgress, approved: sum.approvedProgress, billable: sum.billableProgress, physical });
            return { kind: 'phase', id: ph.id, name: ph.name, category: ph.category, ownValueC: valC(f), valueFromTasks: true, fin: f || null, children, ...rowFigs };
        }
        const valueC = valC(f);
        const bp = billable(f, i.requireApproval);
        const childInv = children.reduce((a, c) => ({ inv: a.inv + c.invoicedC, ret: a.ret + c.retentionC, paid: a.paid + c.paidC }), { inv: 0, ret: 0, paid: 0 });
        return {
            kind: 'phase', id: ph.id, name: ph.name, category: ph.category, ownValueC: valueC, valueFromTasks: false, billedAsWhole: own.invoicedC > 0, fin: f || null, children,
            ...figures(valueC, valueC != null ? (0, money_1.pctOf)(valueC, bp) : 0, own.invoicedC + childInv.inv, own.retentionC + childInv.ret, own.paidC + childInv.paid, { reported: Number(f?.reportedProgress) || 0, approved: Number(f?.approvedProgress) || 0, billable: bp, physical }),
        };
    });
    const unphased = liveTasks.filter((t) => !t.phaseId).map((t) => taskRow(t)).filter((r) => r.ownValueC != null || r.invoicedC);
    const orphanIds = new Set([...Array.from(i.taskFin.keys()), ...i.lines.map((l) => l.taskId).filter(Boolean)].filter((id) => !taskIds.has(id)));
    const orphans = Array.from(orphanIds).map((id) => taskRow({ id, title: 'Removed task', phaseId: null, done: false, order: 999 }, true)).filter((r) => r.ownValueC != null || r.invoicedC);
    const groups = [];
    const labels = { design: 'Design', construction: 'Construction', other: 'Other milestones' };
    for (const cat of ['design', 'construction', 'other']) {
        const rows = phaseRows.filter((r) => r.category === cat);
        if (rows.length)
            groups.push({ category: cat, label: labels[cat], rows, totals: addUp(rows) });
    }
    const loose = [...unphased, ...orphans];
    if (loose.length)
        groups.push({ category: 'unphased', label: 'Unphased work', rows: loose, totals: addUp(loose) });
    const allItems = [...phaseRows, ...loose];
    const allocatedC = (0, money_1.sumCents)(allItems.map((r) => r.valueC ?? 0));
    const revisedContractC = i.originalContractC + i.approvedChangesC;
    const lumpBilled = billed((l) => l.targetType === 'project');
    const lumpSum = allocatedC === 0;
    let lump = null;
    if (lumpSum || lumpBilled.invoicedC) {
        const bp = billable(i.project, i.requireApproval);
        const valueC = lumpSum ? revisedContractC : null;
        lump = {
            kind: 'project', id: 'project', name: lumpSum ? 'Whole project (lump sum)' : 'Billed as lump sum before the breakdown', ownValueC: valueC, fin: i.project,
            ...figures(valueC, valueC != null ? (0, money_1.pctOf)(valueC, bp) : 0, lumpBilled.invoicedC, lumpBilled.retentionC, lumpBilled.paidC, { reported: Number(i.project.reportedProgress) || 0, approved: Number(i.project.approvedProgress) || 0, billable: bp, physical: 0 }),
        };
    }
    const evC = (0, money_1.sumCents)((lump ? [...allItems, lump] : allItems).map((r) => r.evC));
    const contractWorkInvoicedC = (0, money_1.sumCents)(i.lines.filter((l) => l.kind !== 'adjustment').map((l) => l.amountC));
    const invoiceTotalsC = (0, money_1.sumCents)(i.invoices.map((x) => x.totalC));
    const paidC = (0, money_1.sumCents)(i.payments.map((p) => p.amountC));
    const overdue = i.invoices.filter((x) => x.dueDate && x.dueDate < i.today && x.totalC - (paidByInvoice.get(x.id) || 0) > 0);
    const unallocatedC = revisedContractC - allocatedC;
    return {
        summary: {
            originalContractC: i.originalContractC, approvedChangesC: i.approvedChangesC, revisedContractC, allocatedC, unallocatedC,
            allocation: lumpSum ? 'under' : unallocatedC > 0 ? 'under' : unallocatedC === 0 ? 'full' : 'over',
            evC, contractWorkInvoicedC, invoiceTotalsC, paidC, arOutstandingC: invoiceTotalsC - paidC,
            unbilledEarnedC: evC - contractWorkInvoicedC, overBilledC: Math.max(contractWorkInvoicedC - evC, 0),
            remainingContractC: revisedContractC - contractWorkInvoicedC,
            retentionHeldC: (0, money_1.sumCents)(i.lines.map((l) => l.retentionC)),
            billableNowC: (0, money_1.sumCents)([...phaseRows.flatMap((r) => (r.valueFromTasks ? r.children || [] : [r])), ...loose, ...(lump ? [lump] : [])].map((r) => r.billableC)),
            overdueC: (0, money_1.sumCents)(overdue.map((x) => x.totalC - (paidByInvoice.get(x.id) || 0))), overdueCount: overdue.length, lumpSum,
        },
        groups, lump,
    };
}
function toDollars(x) {
    if (Array.isArray(x))
        return x.map(toDollars);
    if (x instanceof Map)
        return Object.fromEntries(Array.from(x.entries()).map(([k, v]) => [k, toDollars(v)]));
    if (x && typeof x === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(x)) {
            if (/C$/.test(k) && (typeof v === 'number' || v === null))
                out[k.slice(0, -1)] = v == null ? null : (0, money_1.fromCents)(v);
            else
                out[k] = toDollars(v);
        }
        return out;
    }
    return x;
}
//# sourceMappingURL=finance.calc.js.map