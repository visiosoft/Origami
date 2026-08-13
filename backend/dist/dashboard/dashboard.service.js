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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const dashboard_1 = require("../seed-data/dashboard");
const pipeline_1 = require("../seed-data/pipeline");
const tasks_1 = require("../seed-data/tasks");
let DashboardService = class DashboardService {
    constructor(finance, invoices, deals, tasks) {
        this.finance = finance;
        this.invoices = invoices;
        this.deals = deals;
        this.tasks = tasks;
    }
    async finRows() {
        return this.finance ? this.finance.find() : dashboard_1.FINANCE;
    }
    async internalInvoices() {
        return this.invoices ? this.invoices.findBy({ kind: 'internal' }) : dashboard_1.INVOICES.internal;
    }
    async dealRows() {
        return this.deals ? this.deals.find() : pipeline_1.DEALS;
    }
    async taskRows() {
        if (this.tasks)
            return this.tasks.find();
        return [...tasks_1.ALL_TASKS.internal, ...tasks_1.ALL_TASKS.owner, ...tasks_1.ALL_TASKS.subcontractor];
    }
    async getKpis() {
        const fin = await this.finRows();
        const active = fin.filter((f) => f.phase !== 'Leads');
        const contractValue = active.reduce((t, f) => t + f.base + f.co + f.reimb, 0);
        const internal = await this.internalInvoices();
        const outstandingInvoices = internal.reduce((t, i) => t + (i.amount - i.paid), 0);
        const deals = await this.dealRows();
        const lost = deals.filter((d) => d.stage === 'rejected').length;
        return {
            activeProjects: active.length,
            leadPipeline: { total: deals.length, won: 0, lost, live: deals.length - lost },
            contractValue,
            outstandingInvoices,
        };
    }
    async getBudgetVsSpend() {
        const fin = await this.finRows();
        return fin.map((f) => ({
            name: f.name, exec: f.exec, contractType: f.contract, phase: f.phase,
            base: f.base, co: f.co, reimb: f.reimb,
            baseUsed: f.baseUsed, coUsed: f.coUsed, reimbUsed: f.reimbUsed, timePct: f.timePct,
        }));
    }
    async getRevenueByMonth() {
        const internal = await this.internalInvoices();
        const byMonth = new Map();
        for (const inv of internal) {
            const m = byMonth.get(inv.month) ?? { collected: 0, outstanding: 0, issued: inv.issued };
            m.collected += inv.paid;
            m.outstanding += inv.amount - inv.paid;
            if (inv.issued < m.issued)
                m.issued = inv.issued;
            byMonth.set(inv.month, m);
        }
        return [...byMonth.entries()]
            .sort((a, b) => a[1].issued.localeCompare(b[1].issued))
            .map(([month, v]) => ({ month, collected: v.collected, outstanding: v.outstanding }));
    }
    async getLeadFunnel() {
        const deals = await this.dealRows();
        const base = deals.length || 24;
        const steps = [
            { stage: 'Inbound leads', factor: 1 },
            { stage: 'Qualified', factor: 0.67 },
            { stage: 'Face to face held', factor: 0.46 },
            { stage: 'Proposal sent', factor: 0.29 },
            { stage: 'Client approval', factor: 0.17 },
            { stage: 'Contract signed', factor: 0.13 },
        ];
        return steps.map((s) => ({ stage: s.stage, count: Math.round(base * s.factor), conversionPct: Math.round(s.factor * 100) }));
    }
    async getWorkload() {
        const tasks = await this.taskRows();
        const counts = new Map();
        for (const t of tasks) {
            if (!t.assignedTo)
                continue;
            counts.set(t.assignedTo, (counts.get(t.assignedTo) ?? 0) + 1);
        }
        return [...counts.entries()].map(([name, n]) => ({ name, tasks: n })).sort((a, b) => b.tasks - a.tasks);
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.FinanceEntity)),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.InvoiceEntity)),
    __param(2, (0, common_1.Optional)()),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.DealEntity)),
    __param(3, (0, common_1.Optional)()),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map