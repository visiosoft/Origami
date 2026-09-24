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
exports.FinanceCostFilesController = exports.FinanceReimbursableFilesController = exports.FinanceChangeOrderFilesController = exports.FinanceInvoiceFilesController = exports.FinanceController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const stream_1 = require("stream");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const auth_service_1 = require("../auth/auth.service");
const attachments_service_1 = require("../google/attachments.service");
const update_task_dto_1 = require("../tasks/dto/update-task.dto");
const manpower_access_service_1 = require("../manpower/manpower-access.service");
const financials_service_1 = require("./financials.service");
const invoices_service_1 = require("./invoices.service");
const change_orders_service_1 = require("./change-orders.service");
const reimbursables_service_1 = require("./reimbursables.service");
const retention_service_1 = require("./retention.service");
const finance_hub_service_1 = require("./finance-hub.service");
const costs_service_1 = require("./costs.service");
const reports_service_1 = require("./reports.service");
const kindOf = (k) => {
    if (k !== 'phase' && k !== 'task' && k !== 'project')
        throw new common_1.BadRequestException('Unknown item.');
    return k;
};
let FinanceController = class FinanceController {
    constructor(fin, invoices, cos, reimbs, retention, hub, access, costs, reports) {
        this.fin = fin;
        this.invoices = invoices;
        this.cos = cos;
        this.reimbs = reimbs;
        this.retention = retention;
        this.hub = hub;
        this.access = access;
        this.costs = costs;
        this.reports = reports;
    }
    actor(a) { return this.access.actor(a); }
    async rights(a) { return this.fin.rights(await this.actor(a)); }
    async brand(a) { return this.fin.brand(await this.actor(a)); }
    async portfolio(a) { return this.hub.portfolio(await this.actor(a)); }
    async pending(a) { return this.hub.pending(await this.actor(a)); }
    async audit(q, a) { return this.hub.audit(await this.actor(a), q || {}); }
    async allCos(a) { return this.cos.all(await this.actor(a)); }
    async allReimbs(a) { return this.reimbs.all(await this.actor(a)); }
    async overview(id, a) { return this.fin.overview(Number(id), await this.actor(a)); }
    async settings(id, dto, a) { return this.fin.saveSettings(Number(id), dto, await this.actor(a)); }
    async milestone(id, dto, a) { return this.fin.addMilestone(Number(id), dto, await this.actor(a)); }
    async activity(id, a) { return this.fin.activity(Number(id), await this.actor(a)); }
    async invoiceList(id, a) { return this.invoices.list(Number(id), await this.actor(a)); }
    async draft(id, dto, a) { return this.invoices.createDraft(Number(id), dto, await this.actor(a)); }
    async payments(id, a) { return this.invoices.projectPayments(Number(id), await this.actor(a)); }
    async cosOf(id, a) { return this.cos.list(Number(id), await this.actor(a)); }
    async newCo(id, dto, a) { return this.cos.create(Number(id), dto, await this.actor(a)); }
    async reimbsOf(id, a) { return this.reimbs.list(Number(id), await this.actor(a)); }
    async newReimb(id, dto, a) { return this.reimbs.create(Number(id), dto, await this.actor(a)); }
    async retentionOf(id, a) { return this.retention.overview(Number(id), await this.actor(a)); }
    async requestRelease(id, dto, a) { return this.retention.request(Number(id), dto, await this.actor(a)); }
    async costsOf(id, a) { return this.costs.overview(Number(id), await this.actor(a)); }
    async budgetLine(id, dto, a) { return this.costs.saveBudgetLine(Number(id), dto, await this.actor(a)); }
    async removeBudgetLine(id, a) { return this.costs.removeBudgetLine(id, await this.actor(a)); }
    async forecast(id, dto, a) { return this.costs.setForecast(Number(id), dto, await this.actor(a)); }
    async commitment(id, dto, a) { return this.costs.saveCommitment(Number(id), dto, await this.actor(a)); }
    async commitmentStep(id, action, dto, a) { return this.costs.commitmentStep(id, action, dto || {}, await this.actor(a)); }
    async costEntry(id, dto, a) { return this.costs.saveEntry(Number(id), dto, await this.actor(a)); }
    async costEntryStep(id, action, dto, a) { return this.costs.entryStep(id, action, dto || {}, await this.actor(a)); }
    async wip(a) { return this.reports.wip(await this.actor(a)); }
    async aging(asOf, a) { return this.reports.arAging(await this.actor(a), asOf); }
    async bva(projectId, a) { return this.reports.budgetVsActual(await this.actor(a), projectId ? Number(projectId) : undefined); }
    async coRegister(a) { return this.reports.changeOrderRegister(await this.actor(a)); }
    async retentionReport(a) { return this.reports.retention(await this.actor(a)); }
    async contractReport(a) { return this.reports.contractVsInvoiced(await this.actor(a)); }
    async cash(months, a) { return this.reports.cashForecast(await this.actor(a), Number(months) || 6); }
    async item(kind, id, dto, a) {
        const k = kindOf(kind);
        if (k === 'project')
            throw new common_1.BadRequestException('Project values are set in the project’s financial settings.');
        return this.fin.updateItem(k, id, dto, await this.actor(a));
    }
    async progress(kind, id, dto, a) {
        return this.fin.reportProgress(kindOf(kind), id, dto, await this.actor(a));
    }
    async approve(kind, id, dto, a) {
        return this.fin.approveProgress(kindOf(kind), id, dto, await this.actor(a));
    }
    async history(kind, id, a) {
        return this.fin.progressHistory(kindOf(kind), id, await this.actor(a));
    }
    async itemInvoices(kind, id, a) {
        return this.fin.itemInvoices(kindOf(kind), id, await this.actor(a));
    }
    async invoice(id, a) { return this.invoices.get(id, await this.actor(a)); }
    async updateDraft(id, dto, a) { return this.invoices.updateDraft(id, dto, await this.actor(a)); }
    async removeDraft(id, a) { return this.invoices.removeDraft(id, await this.actor(a)); }
    async issue(id, dto, a) { return this.invoices.issue(id, dto, await this.actor(a)); }
    async void(id, dto, a) { return this.invoices.void(id, dto, await this.actor(a)); }
    async requestApproval(id, dto, a) { return this.invoices.requestApproval(id, dto, await this.actor(a)); }
    async returnDraft(id, dto, a) { return this.invoices.returnDraft(id, dto, await this.actor(a)); }
    async credit(id, dto, a) { return this.invoices.createCredit(id, dto, await this.actor(a)); }
    async pay(id, dto, a) { return this.invoices.recordPayment(id, dto, await this.actor(a)); }
    async voidPayment(id, dto, a) { return this.invoices.voidPayment(id, dto, await this.actor(a)); }
    async co(id, a) { return this.cos.get(id, await this.actor(a)); }
    async coImpact(id, a) { return this.cos.impact(id, await this.actor(a)); }
    async updateCo(id, dto, a) { return this.cos.update(id, dto, await this.actor(a)); }
    async removeCo(id, a) { return this.cos.remove(id, await this.actor(a)); }
    async actCo(id, action, dto, a) {
        return this.cos.act(id, action, dto || {}, await this.actor(a));
    }
    async reimb(id, a) { return this.reimbs.get(id, await this.actor(a)); }
    async updateReimb(id, dto, a) { return this.reimbs.update(id, dto, await this.actor(a)); }
    async removeReimb(id, a) { return this.reimbs.remove(id, await this.actor(a)); }
    async decideReimb(id, dto, a) { return this.reimbs.decide(id, dto, await this.actor(a)); }
    async decideRelease(id, dto, a) { return this.retention.decide(id, dto, await this.actor(a)); }
    async billRelease(id, a) { return this.retention.bill(id, await this.actor(a)); }
};
exports.FinanceController = FinanceController;
__decorate([
    (0, common_1.Get)('access'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "rights", null);
__decorate([
    (0, common_1.Get)('brand'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "brand", null);
__decorate([
    (0, common_1.Get)('portfolio'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "portfolio", null);
__decorate([
    (0, common_1.Get)('approvals'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "pending", null);
__decorate([
    (0, common_1.Get)('audit'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "audit", null);
__decorate([
    (0, common_1.Get)('change-orders'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "allCos", null);
__decorate([
    (0, common_1.Get)('reimbursables'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "allReimbs", null);
__decorate([
    (0, common_1.Get)('projects/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "overview", null);
__decorate([
    (0, common_1.Put)('projects/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "settings", null);
__decorate([
    (0, common_1.Post)('projects/:id/milestones'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "milestone", null);
__decorate([
    (0, common_1.Get)('projects/:id/activity'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "activity", null);
__decorate([
    (0, common_1.Get)('projects/:id/invoices'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "invoiceList", null);
__decorate([
    (0, common_1.Post)('projects/:id/invoices'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "draft", null);
__decorate([
    (0, common_1.Get)('projects/:id/payments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "payments", null);
__decorate([
    (0, common_1.Get)('projects/:id/change-orders'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "cosOf", null);
__decorate([
    (0, common_1.Post)('projects/:id/change-orders'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "newCo", null);
__decorate([
    (0, common_1.Get)('projects/:id/reimbursables'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "reimbsOf", null);
__decorate([
    (0, common_1.Post)('projects/:id/reimbursables'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "newReimb", null);
__decorate([
    (0, common_1.Get)('projects/:id/retention'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "retentionOf", null);
__decorate([
    (0, common_1.Post)('projects/:id/retention/releases'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "requestRelease", null);
__decorate([
    (0, common_1.Get)('projects/:id/costs'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "costsOf", null);
__decorate([
    (0, common_1.Post)('projects/:id/budget-lines'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "budgetLine", null);
__decorate([
    (0, common_1.Delete)('budget-lines/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "removeBudgetLine", null);
__decorate([
    (0, common_1.Put)('projects/:id/forecasts'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "forecast", null);
__decorate([
    (0, common_1.Post)('projects/:id/commitments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "commitment", null);
__decorate([
    (0, common_1.Post)('commitments/:id/:action'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('action')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "commitmentStep", null);
__decorate([
    (0, common_1.Post)('projects/:id/cost-entries'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "costEntry", null);
__decorate([
    (0, common_1.Post)('cost-entries/:id/:action'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('action')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "costEntryStep", null);
__decorate([
    (0, common_1.Get)('reports/wip'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "wip", null);
__decorate([
    (0, common_1.Get)('reports/ar-aging'),
    __param(0, (0, common_1.Query)('asOf')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "aging", null);
__decorate([
    (0, common_1.Get)('reports/budget-vs-actual'),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "bva", null);
__decorate([
    (0, common_1.Get)('reports/change-orders'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "coRegister", null);
__decorate([
    (0, common_1.Get)('reports/retention'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "retentionReport", null);
__decorate([
    (0, common_1.Get)('reports/contract-vs-invoiced'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "contractReport", null);
__decorate([
    (0, common_1.Get)('reports/cash-forecast'),
    __param(0, (0, common_1.Query)('months')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "cash", null);
__decorate([
    (0, common_1.Put)('items/:kind/:id'),
    __param(0, (0, common_1.Param)('kind')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "item", null);
__decorate([
    (0, common_1.Post)('items/:kind/:id/progress'),
    __param(0, (0, common_1.Param)('kind')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "progress", null);
__decorate([
    (0, common_1.Post)('items/:kind/:id/progress/approve'),
    __param(0, (0, common_1.Param)('kind')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "approve", null);
__decorate([
    (0, common_1.Get)('items/:kind/:id/progress'),
    __param(0, (0, common_1.Param)('kind')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "history", null);
__decorate([
    (0, common_1.Get)('items/:kind/:id/invoices'),
    __param(0, (0, common_1.Param)('kind')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "itemInvoices", null);
__decorate([
    (0, common_1.Get)('invoices/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "invoice", null);
__decorate([
    (0, common_1.Put)('invoices/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "updateDraft", null);
__decorate([
    (0, common_1.Delete)('invoices/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "removeDraft", null);
__decorate([
    (0, common_1.Post)('invoices/:id/issue'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "issue", null);
__decorate([
    (0, common_1.Post)('invoices/:id/void'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "void", null);
__decorate([
    (0, common_1.Post)('invoices/:id/request-approval'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "requestApproval", null);
__decorate([
    (0, common_1.Post)('invoices/:id/return'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "returnDraft", null);
__decorate([
    (0, common_1.Post)('invoices/:id/credit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "credit", null);
__decorate([
    (0, common_1.Post)('invoices/:id/payments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "pay", null);
__decorate([
    (0, common_1.Post)('payments/:id/void'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "voidPayment", null);
__decorate([
    (0, common_1.Get)('change-orders/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "co", null);
__decorate([
    (0, common_1.Get)('change-orders/:id/impact'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "coImpact", null);
__decorate([
    (0, common_1.Put)('change-orders/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "updateCo", null);
__decorate([
    (0, common_1.Delete)('change-orders/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "removeCo", null);
__decorate([
    (0, common_1.Post)('change-orders/:id/:action'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('action')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "actCo", null);
__decorate([
    (0, common_1.Get)('reimbursables/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "reimb", null);
__decorate([
    (0, common_1.Put)('reimbursables/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "updateReimb", null);
__decorate([
    (0, common_1.Delete)('reimbursables/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "removeReimb", null);
__decorate([
    (0, common_1.Post)('reimbursables/:id/decision'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "decideReimb", null);
__decorate([
    (0, common_1.Post)('retention-releases/:id/decision'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "decideRelease", null);
__decorate([
    (0, common_1.Post)('retention-releases/:id/bill'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FinanceController.prototype, "billRelease", null);
exports.FinanceController = FinanceController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('finance'),
    __metadata("design:paramtypes", [financials_service_1.FinancialsService,
        invoices_service_1.InvoicesService,
        change_orders_service_1.ChangeOrdersService,
        reimbursables_service_1.ReimbursablesService,
        retention_service_1.RetentionService,
        finance_hub_service_1.FinanceHubService,
        manpower_access_service_1.ManpowerAccess,
        costs_service_1.CostsService,
        reports_service_1.ReportsService])
], FinanceController);
class FinanceFilesBase {
    constructor(fin, auth, attachments, access) {
        this.fin = fin;
        this.auth = auth;
        this.attachments = attachments;
        this.access = access;
    }
    async manage(a) {
        const actor = await this.access.actor(a);
        if (!(await this.fin.rights(actor))[this.right])
            throw new common_1.BadRequestException("Your role doesn't allow changing these documents.");
    }
    async upload(id, files, a) {
        await this.manage(a);
        return this.owner().addAttachments(id, files, await this.auth.requireActor(a));
    }
    async link(id, dto, a) {
        await this.manage(a);
        return this.owner().addLink(id, dto.name ?? '', dto.url, await this.auth.actor(a));
    }
    async remove(id, attId, a) {
        await this.manage(a);
        return this.owner().removeAttachment(id, attId);
    }
    async content(id, attId, thumb, res) {
        const att = await this.owner().attachment(id, attId);
        const file = await this.attachments.download(att, thumb === '1');
        const inline = attachments_service_1.AttachmentsService.inlineSafe(file.mimeType);
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        stream_1.Readable.fromWeb(file.body).pipe(res);
    }
}
__decorate([
    (0, common_1.Post)(':id/attachments'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', attachments_service_1.MAX_FILES_PER_UPLOAD, { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String]),
    __metadata("design:returntype", Promise)
], FinanceFilesBase.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(':id/attachments/link'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_task_dto_1.AddLinkDto, String]),
    __metadata("design:returntype", Promise)
], FinanceFilesBase.prototype, "link", null);
__decorate([
    (0, common_1.Delete)(':id/attachments/:attId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], FinanceFilesBase.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/attachments/:attId/content'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Query)('thumb')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], FinanceFilesBase.prototype, "content", null);
let FinanceInvoiceFilesController = class FinanceInvoiceFilesController extends FinanceFilesBase {
    constructor(invoices, fin, auth, attachments, access) {
        super(fin, auth, attachments, access);
        this.invoices = invoices;
        this.right = 'prepareInvoice';
    }
    owner() { return this.invoices; }
};
exports.FinanceInvoiceFilesController = FinanceInvoiceFilesController;
exports.FinanceInvoiceFilesController = FinanceInvoiceFilesController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('finance-invoices'),
    __metadata("design:paramtypes", [invoices_service_1.InvoicesService, financials_service_1.FinancialsService, auth_service_1.AuthService, attachments_service_1.AttachmentsService, manpower_access_service_1.ManpowerAccess])
], FinanceInvoiceFilesController);
let FinanceChangeOrderFilesController = class FinanceChangeOrderFilesController extends FinanceFilesBase {
    constructor(cos, fin, auth, attachments, access) {
        super(fin, auth, attachments, access);
        this.cos = cos;
        this.right = 'editChangeOrders';
    }
    owner() { return this.cos; }
};
exports.FinanceChangeOrderFilesController = FinanceChangeOrderFilesController;
exports.FinanceChangeOrderFilesController = FinanceChangeOrderFilesController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('finance-change-orders'),
    __metadata("design:paramtypes", [change_orders_service_1.ChangeOrdersService, financials_service_1.FinancialsService, auth_service_1.AuthService, attachments_service_1.AttachmentsService, manpower_access_service_1.ManpowerAccess])
], FinanceChangeOrderFilesController);
let FinanceReimbursableFilesController = class FinanceReimbursableFilesController extends FinanceFilesBase {
    constructor(reimbs, fin, auth, attachments, access) {
        super(fin, auth, attachments, access);
        this.reimbs = reimbs;
        this.right = 'submitReimbursables';
    }
    owner() { return this.reimbs; }
};
exports.FinanceReimbursableFilesController = FinanceReimbursableFilesController;
exports.FinanceReimbursableFilesController = FinanceReimbursableFilesController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('finance-reimbursables'),
    __metadata("design:paramtypes", [reimbursables_service_1.ReimbursablesService, financials_service_1.FinancialsService, auth_service_1.AuthService, attachments_service_1.AttachmentsService, manpower_access_service_1.ManpowerAccess])
], FinanceReimbursableFilesController);
let FinanceCostFilesController = class FinanceCostFilesController extends FinanceFilesBase {
    constructor(costs, fin, auth, attachments, access) {
        super(fin, auth, attachments, access);
        this.costs = costs;
        this.right = 'manageCosts';
    }
    owner() { return this.costs; }
};
exports.FinanceCostFilesController = FinanceCostFilesController;
exports.FinanceCostFilesController = FinanceCostFilesController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('finance-costs'),
    __metadata("design:paramtypes", [costs_service_1.CostsService, financials_service_1.FinancialsService, auth_service_1.AuthService, attachments_service_1.AttachmentsService, manpower_access_service_1.ManpowerAccess])
], FinanceCostFilesController);
//# sourceMappingURL=finance.controller.js.map