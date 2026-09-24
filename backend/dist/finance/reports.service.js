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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const workforce_util_1 = require("../manpower/workforce.util");
const finance_calc_1 = require("./finance.calc");
const financials_service_1 = require("./financials.service");
const change_orders_service_1 = require("./change-orders.service");
const costs_service_1 = require("./costs.service");
const costs_calc_1 = require("./costs.calc");
const money_1 = require("./money");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const monthOf = (d) => d.slice(0, 7);
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
let ReportsService = class ReportsService {
    constructor(fin, costs, cos, projects, pfin, invoices, payments, releases, entries) {
        this.fin = fin;
        this.costs = costs;
        this.cos = cos;
        this.projects = projects;
        this.pfin = pfin;
        this.invoices = invoices;
        this.payments = payments;
        this.releases = releases;
        this.entries = entries;
    }
    async projectsIn(projectId) {
        const [settings, projects] = await Promise.all([this.pfin.find(), this.projects.find()]);
        const byId = new Map(projects.map((p) => [p.id, p]));
        return settings.filter((s) => byId.has(s.projectId) && (!projectId || s.projectId === projectId)).map((s) => byId.get(s.projectId)).sort((a, b) => a.name.localeCompare(b.name));
    }
    async wip(actor) {
        await this.fin.need(actor, 'viewProfitability');
        const labor = await this.costs.laborAll();
        const rows = [];
        const withoutCosts = [];
        for (const p of await this.projectsIn()) {
            const [sov, cost] = await Promise.all([this.fin.context(p.id).then((c) => (0, finance_calc_1.computeSov)(c.input)), this.costs.context(p.id, labor)]);
            if (!cost.jc.totals.eacC && !cost.jc.totals.actualC) {
                withoutCosts.push(p.name);
                continue;
            }
            const reimbCostC = (0, money_1.sumCents)(cost.reimbs.filter((r) => r.status === 'approved' || r.status === 'billed').map((r) => (0, money_1.toCents)(r.cost)));
            const prof = (0, costs_calc_1.profitability)({
                contractC: sov.summary.revisedContractC, evC: sov.summary.evC, contractWorkInvoicedC: sov.summary.contractWorkInvoicedC,
                actualC: cost.jc.totals.actualC, eacC: cost.jc.totals.eacC, reimbursablesBilledC: sov.summary.reimbursablesBilledC, reimbursableCostC: reimbCostC,
            });
            rows.push({ projectId: p.id, name: p.name, stage: p.stage, ...(0, finance_calc_1.toDollars)({ ...prof, budgetC: cost.jc.totals.budgetC, committedC: cost.jc.totals.committedC }) });
        }
        return { asOf: (0, workforce_util_1.todayISO)(), rows, withoutCosts };
    }
    async arAging(actor, asOfIn) {
        await this.fin.need(actor, 'view');
        const asOf = asOfIn && ISO.test(asOfIn) ? asOfIn : (0, workforce_util_1.todayISO)();
        const [invs, pays, projects] = await Promise.all([this.invoices.find({ where: { status: 'issued' } }), this.payments.find(), this.projects.find()]);
        const name = new Map(projects.map((p) => [p.id, p.name]));
        const credits = new Map();
        for (const c of invs)
            if (c.kind === 'credit' && c.creditForInvoiceId)
                credits.set(c.creditForInvoiceId, (credits.get(c.creditForInvoiceId) || 0) + (0, money_1.toCents)(c.total));
        const paid = new Map();
        for (const p of pays)
            if (!p.voidedAt && p.date <= asOf)
                paid.set(p.invoiceId, (paid.get(p.invoiceId) || 0) + (0, money_1.toCents)(p.amount));
        const rows = invs.filter((i) => i.kind !== 'credit' && i.invoiceDate <= asOf).map((i) => {
            const outstandingC = (0, money_1.toCents)(i.total) + (credits.get(i.id) || 0) - (paid.get(i.id) || 0);
            const { bucket, daysPastDue } = (0, costs_calc_1.agingBucket)(i.dueDate, asOf);
            return { invoiceId: i.id, number: i.issuedNumber, projectId: i.projectId, projectName: name.get(i.projectId) || `Project ${i.projectId}`, billTo: i.billToName, invoiceDate: i.invoiceDate, dueDate: i.dueDate, bucket, daysPastDue, totalC: (0, money_1.toCents)(i.total), outstandingC };
        }).filter((r) => r.outstandingC > 0).sort((a, b) => b.daysPastDue - a.daysPastDue);
        const totals = Object.fromEntries(costs_calc_1.AGING_BUCKETS.map((b) => [b, (0, money_1.sumCents)(rows.filter((r) => r.bucket === b).map((r) => r.outstandingC))]));
        const byProject = new Map();
        for (const r of rows) {
            const x = byProject.get(r.projectId) || { projectId: r.projectId, name: r.projectName, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
            x[r.bucket] += r.outstandingC;
            x.total += r.outstandingC;
            byProject.set(r.projectId, x);
        }
        const toD = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' && k !== 'projectId' && k !== 'daysPastDue' ? v / 100 : v]));
        return {
            asOf, buckets: costs_calc_1.AGING_BUCKETS, totals: toD({ ...totals, total: (0, money_1.sumCents)(rows.map((r) => r.outstandingC)) }),
            projects: Array.from(byProject.values()).map(toD), invoices: rows.map((r) => ({ ...r, total: r.totalC / 100, outstanding: r.outstandingC / 100, totalC: undefined, outstandingC: undefined })),
        };
    }
    async budgetVsActual(actor, projectId) {
        await this.fin.need(actor, 'viewProfitability');
        if (projectId)
            return { projectId, ...(await this.costs.overview(projectId, actor)) };
        const labor = await this.costs.laborAll();
        const rows = [];
        for (const p of await this.projectsIn()) {
            const c = await this.costs.context(p.id, labor);
            rows.push({ projectId: p.id, name: p.name, ...(0, finance_calc_1.toDollars)(c.jc.totals) });
        }
        return { rows };
    }
    async changeOrderRegister(actor) {
        const all = await this.cos.all(actor);
        return all.map((c) => ({
            id: c.id, projectId: c.projectId, projectName: c.projectName, number: c.number, title: c.title, reason: c.reason, status: c.status,
            amount: c.total, cost: c.cost, margin: c.margin, scheduleImpactDays: c.scheduleImpactDays, dateRequested: c.dateRequested, submittedAt: c.submittedAt,
            approvedDate: c.clientApprovedDate || c.approvedAt, signer: c.clientSigner,
            daysToApprove: c.status === 'approved' && c.dateRequested && (c.clientApprovedDate || c.approvedAt)
                ? Math.max(0, Math.round((Date.parse((c.clientApprovedDate || c.approvedAt).slice(0, 10)) - Date.parse(c.dateRequested)) / 86400000)) : null,
        }));
    }
    async retention(actor) {
        await this.fin.need(actor, 'view');
        const releases = await this.releases.find();
        const rows = [];
        for (const p of await this.projectsIn()) {
            const s = (0, finance_calc_1.computeSov)((await this.fin.context(p.id)).input).summary;
            const open = releases.filter((r) => r.projectId === p.id && (r.status === 'requested' || r.status === 'approved'));
            rows.push({ projectId: p.id, name: p.name, ...(0, finance_calc_1.toDollars)({ accruedC: s.retentionAccruedC, releasedC: s.retentionReleasedC, heldC: s.retentionHeldC, openC: (0, money_1.sumCents)(open.map((r) => (0, money_1.toCents)(r.amount))) }), openCount: open.length });
        }
        return { rows };
    }
    async contractVsInvoiced(actor) {
        await this.fin.need(actor, 'view');
        const rows = [];
        for (const p of await this.projectsIn()) {
            const s = (0, finance_calc_1.computeSov)((await this.fin.context(p.id)).input).summary;
            rows.push({
                projectId: p.id, name: p.name, stage: p.stage,
                ...(0, finance_calc_1.toDollars)({
                    originalC: s.originalContractC, changesC: s.approvedChangesC, pendingC: s.pendingChangesC, revisedC: s.revisedContractC, evC: s.evC,
                    invoicedC: s.contractWorkInvoicedC, remainingC: s.remainingContractC, unbilledC: s.unbilledEarnedC, paidC: s.paidC, outstandingC: s.arOutstandingC,
                }),
                billedPct: s.revisedContractC ? Math.round((s.contractWorkInvoicedC / s.revisedContractC) * 1000) / 10 : 0,
            });
        }
        return { rows };
    }
    async cashForecast(actor, months = 6) {
        const r = await this.fin.need(actor, 'view');
        const n = Math.min(Math.max(Number(months) || 6, 1), 24);
        const start = monthOf((0, workforce_util_1.todayISO)());
        const keys = Array.from({ length: n }, (_, i) => addMonths(start, i));
        const bucket = (d) => { const m = monthOf(d || (0, workforce_util_1.todayISO)()); return m < start ? start : keys.includes(m) ? m : null; };
        const aging = await this.arAging(actor);
        const inflow = new Map(keys.map((k) => [k, 0]));
        for (const i of aging.invoices) {
            const k = bucket(i.dueDate);
            if (k)
                inflow.set(k, inflow.get(k) + (0, money_1.toCents)(i.outstanding));
        }
        const outflow = new Map(keys.map((k) => [k, 0]));
        const showCosts = r.viewProfitability;
        if (showCosts) {
            for (const e of await this.entries.find()) {
                if (e.status !== 'recorded' && e.status !== 'approved')
                    continue;
                const k = bucket(e.dueDate || e.date);
                if (k)
                    outflow.set(k, outflow.get(k) + (0, money_1.toCents)(e.amount));
            }
        }
        let running = 0;
        return {
            showCosts,
            months: keys.map((k) => {
                const net = inflow.get(k) - outflow.get(k);
                running += net;
                return { month: k, ...(0, finance_calc_1.toDollars)({ inC: inflow.get(k), outC: outflow.get(k), netC: net, cumulativeC: running }) };
            }),
        };
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ProjectFinancialEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.ProjectInvoiceEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.ProjectPaymentEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.RetentionReleaseEntity)),
    __param(8, (0, typeorm_1.InjectRepository)(entities_1.CostEntryEntity)),
    __metadata("design:paramtypes", [financials_service_1.FinancialsService,
        costs_service_1.CostsService,
        change_orders_service_1.ChangeOrdersService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ReportsService);
//# sourceMappingURL=reports.service.js.map