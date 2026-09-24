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
exports.FinanceHubService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const finance_calc_1 = require("./finance.calc");
const financials_service_1 = require("./financials.service");
const invoices_service_1 = require("./invoices.service");
const money_1 = require("./money");
let FinanceHubService = class FinanceHubService {
    constructor(fin, projects, pfin, cos, coItems, reimbs, releases, invoices, phfin, tfin, phases, tasks, activity, lines) {
        this.fin = fin;
        this.projects = projects;
        this.pfin = pfin;
        this.cos = cos;
        this.coItems = coItems;
        this.reimbs = reimbs;
        this.releases = releases;
        this.invoices = invoices;
        this.phfin = phfin;
        this.tfin = tfin;
        this.phases = phases;
        this.tasks = tasks;
        this.activity = activity;
        this.lines = lines;
    }
    async names() {
        return new Map((await this.projects.find()).map((p) => [p.id, p.name]));
    }
    async pending(actor) {
        const r = await this.fin.rights(actor);
        const name = await this.names();
        const pn = (id) => name.get(id) || `Project ${id}`;
        const out = [];
        if (r.viewChangeOrders) {
            const open = await this.cos.find({ where: { status: (0, typeorm_2.In)(['internal_review', 'submitted']) } });
            const items = open.length ? await this.coItems.find({ where: { changeOrderId: (0, typeorm_2.In)(open.map((c) => c.id)) } }) : [];
            for (const c of open) {
                out.push({
                    type: 'change_order', id: c.id, projectId: c.projectId, projectName: pn(c.projectId), title: `${c.number} ${c.title}`,
                    detail: c.status === 'internal_review' ? `Internal review · submitted by ${c.submittedBy || '—'}` : 'With the client for approval',
                    amount: (0, money_1.fromCents)((0, money_1.sumCents)(items.filter((i) => i.changeOrderId === c.id).map((i) => (0, money_1.toCents)(i.amount)))),
                    since: c.status === 'internal_review' ? c.submittedAt : c.internalApprovedAt || c.updatedAt, canAct: r.approveChangeOrders,
                });
            }
        }
        if (r.viewReimbursables) {
            for (const x of await this.reimbs.find({ where: { status: 'submitted' } })) {
                out.push({
                    type: 'reimbursable', id: x.id, projectId: x.projectId, projectName: pn(x.projectId), title: `${x.number} ${x.description}`,
                    detail: `Submitted by ${x.submittedBy || '—'}${x.vendor ? ` · ${x.vendor}` : ''}`, amount: (0, money_1.fromCents)((0, invoices_service_1.reimbursableBillC)(x)), since: x.createdAt, canAct: r.approveReimbursables,
                });
            }
        }
        if (r.view) {
            for (const x of await this.releases.find({ where: { status: 'requested' } })) {
                out.push({
                    type: 'retention_release', id: x.id, projectId: x.projectId, projectName: pn(x.projectId), title: `${x.number} Retention release`,
                    detail: `${x.scope === 'project' ? 'Whole project' : x.scope} · requested by ${x.requestedBy || '—'}`, amount: x.amount, since: x.createdAt, canAct: r.releaseRetention,
                });
            }
            const waiting = (await this.invoices.find({ where: { status: 'draft' } })).filter((i) => i.approvalRequestedAt);
            const draftLines = waiting.length ? await this.lines.find({ where: { invoiceId: (0, typeorm_2.In)(waiting.map((i) => i.id)) } }) : [];
            for (const x of waiting) {
                const total = (0, finance_calc_1.invoiceTotals)(draftLines.filter((l) => l.invoiceId === x.id).map((l) => ({ kind: l.kind, amountC: (0, money_1.toCents)(l.amount), retentionApplies: l.retentionApplies, retentionPct: l.retentionPct, taxable: l.taxable, taxPct: l.taxPct }))).totalC;
                out.push({
                    type: 'invoice', id: x.id, projectId: x.projectId, projectName: pn(x.projectId),
                    title: `Draft ${x.kind === 'credit' ? (x.creditType === 'write_off' ? 'write-off' : 'credit note') : x.kind === 'retention' ? 'retention invoice' : 'invoice'}${x.description ? ` — ${x.description}` : ''}`,
                    detail: `Sent for approval by ${x.approvalRequestedBy || '—'}`, amount: (0, money_1.fromCents)(total), since: x.approvalRequestedAt, canAct: r.issueInvoice,
                });
            }
            const strict = (await this.pfin.find()).filter((s) => s.requireProgressApproval);
            if (strict.length) {
                const ids = strict.map((s) => s.projectId);
                const [ph, tk, phRows, tkRows] = await Promise.all([
                    this.phfin.find({ where: { projectId: (0, typeorm_2.In)(ids) } }), this.tfin.find({ where: { projectId: (0, typeorm_2.In)(ids) } }),
                    this.phases.find({ where: { projectId: (0, typeorm_2.In)(ids) } }), this.tasks.find({ where: { projectId: (0, typeorm_2.In)(ids) } }),
                ]);
                const label = new Map([...phRows.map((p) => [p.id, p.name]), ...tkRows.map((t) => [t.id, t.title])]);
                for (const s of strict) {
                    if (Number(s.reportedProgress) > Number(s.approvedProgress)) {
                        out.push({ type: 'progress', itemKind: 'project', id: String(s.projectId), projectId: s.projectId, projectName: pn(s.projectId), title: 'Whole project', detail: `Reported ${s.reportedProgress}% · approved ${s.approvedProgress}%`, amount: null, since: s.updatedAt, canAct: r.approveProgress });
                    }
                }
                for (const [rows, kind, idOf] of [[ph, 'phase', (x) => x.phaseId], [tk, 'task', (x) => x.taskId]]) {
                    for (const x of rows) {
                        if (Number(x.reportedProgress) > Number(x.approvedProgress) && label.has(idOf(x))) {
                            out.push({ type: 'progress', itemKind: kind, id: idOf(x), projectId: x.projectId, projectName: pn(x.projectId), title: label.get(idOf(x)), detail: `Reported ${x.reportedProgress}% · approved ${x.approvedProgress}%`, amount: null, since: x.updatedAt, canAct: r.approveProgress });
                        }
                    }
                }
            }
        }
        return out.sort((a, b) => (a.since || '').localeCompare(b.since || ''));
    }
    async portfolio(actor) {
        await this.fin.need(actor, 'view');
        const [settings, name] = await Promise.all([this.pfin.find(), this.projects.find()]);
        const byId = new Map(name.map((p) => [p.id, p]));
        const rows = [];
        for (const s of settings) {
            const p = byId.get(s.projectId);
            if (!p)
                continue;
            const sov = (0, finance_calc_1.computeSov)((await this.fin.context(s.projectId)).input);
            rows.push({ projectId: p.id, name: p.name, stage: p.stage, ...(0, finance_calc_1.toDollars)(sov.summary) });
        }
        return rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    async audit(actor, q) {
        await this.fin.need(actor, 'view');
        const where = {};
        if (q.projectId)
            where.projectId = Number(q.projectId);
        if (q.entityType)
            where.entityType = q.entityType;
        const [rows, name] = await Promise.all([this.activity.find({ where }), this.names()]);
        const by = q.by?.trim().toLowerCase();
        return rows.filter((a) => !by || (a.byName || '').toLowerCase().includes(by))
            .sort((a, b) => b.at.localeCompare(a.at)).slice(0, Math.min(Number(q.limit) || 500, 2000))
            .map((a) => ({ ...a, projectName: name.get(a.projectId) || `Project ${a.projectId}` }));
    }
};
exports.FinanceHubService = FinanceHubService;
exports.FinanceHubService = FinanceHubService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectFinancialEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.ChangeOrderEntity)),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ChangeOrderItemEntity)),
    __param(5, (0, typeorm_1.InjectRepository)(entities_1.ReimbursableEntity)),
    __param(6, (0, typeorm_1.InjectRepository)(entities_1.RetentionReleaseEntity)),
    __param(7, (0, typeorm_1.InjectRepository)(entities_1.ProjectInvoiceEntity)),
    __param(8, (0, typeorm_1.InjectRepository)(entities_1.PhaseFinancialEntity)),
    __param(9, (0, typeorm_1.InjectRepository)(entities_1.TaskFinancialEntity)),
    __param(10, (0, typeorm_1.InjectRepository)(entities_1.ProjectPhaseEntity)),
    __param(11, (0, typeorm_1.InjectRepository)(entities_1.ProjectTaskEntity)),
    __param(12, (0, typeorm_1.InjectRepository)(entities_1.FinanceActivityEntity)),
    __param(13, (0, typeorm_1.InjectRepository)(entities_1.ProjectInvoiceLineEntity)),
    __metadata("design:paramtypes", [financials_service_1.FinancialsService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], FinanceHubService);
//# sourceMappingURL=finance-hub.service.js.map