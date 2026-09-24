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
exports.FinanceInvoiceFilesController = exports.FinanceController = void 0;
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
const kindOf = (k) => {
    if (k !== 'phase' && k !== 'task' && k !== 'project')
        throw new common_1.BadRequestException('Unknown item.');
    return k;
};
let FinanceController = class FinanceController {
    constructor(fin, invoices, access) {
        this.fin = fin;
        this.invoices = invoices;
        this.access = access;
    }
    actor(a) { return this.access.actor(a); }
    async rights(a) { return this.fin.rights(await this.actor(a)); }
    async brand(a) { return this.fin.brand(await this.actor(a)); }
    async overview(id, a) { return this.fin.overview(Number(id), await this.actor(a)); }
    async settings(id, dto, a) { return this.fin.saveSettings(Number(id), dto, await this.actor(a)); }
    async milestone(id, dto, a) { return this.fin.addMilestone(Number(id), dto, await this.actor(a)); }
    async activity(id, a) { return this.fin.activity(Number(id), await this.actor(a)); }
    async invoiceList(id, a) { return this.invoices.list(Number(id), await this.actor(a)); }
    async draft(id, dto, a) { return this.invoices.createDraft(Number(id), dto, await this.actor(a)); }
    async payments(id, a) { return this.invoices.projectPayments(Number(id), await this.actor(a)); }
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
    async pay(id, dto, a) { return this.invoices.recordPayment(id, dto, await this.actor(a)); }
    async voidPayment(id, dto, a) { return this.invoices.voidPayment(id, dto, await this.actor(a)); }
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
exports.FinanceController = FinanceController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('finance'),
    __metadata("design:paramtypes", [financials_service_1.FinancialsService,
        invoices_service_1.InvoicesService,
        manpower_access_service_1.ManpowerAccess])
], FinanceController);
let FinanceInvoiceFilesController = class FinanceInvoiceFilesController {
    constructor(invoices, fin, auth, attachments, access) {
        this.invoices = invoices;
        this.fin = fin;
        this.auth = auth;
        this.attachments = attachments;
        this.access = access;
    }
    async manage(a) {
        const actor = await this.access.actor(a);
        if (!(await this.fin.rights(actor)).manage)
            throw new common_1.BadRequestException("Your role doesn't allow changing invoices.");
    }
    async upload(id, files, a) {
        await this.manage(a);
        return this.invoices.addAttachments(id, files, await this.auth.requireActor(a));
    }
    async link(id, dto, a) {
        await this.manage(a);
        return this.invoices.addLink(id, dto.name ?? '', dto.url, await this.auth.actor(a));
    }
    async remove(id, attId, a) {
        await this.manage(a);
        return this.invoices.removeAttachment(id, attId);
    }
    async content(id, attId, thumb, res) {
        const att = await this.invoices.attachment(id, attId);
        const file = await this.attachments.download(att, thumb === '1');
        const inline = attachments_service_1.AttachmentsService.inlineSafe(file.mimeType);
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        stream_1.Readable.fromWeb(file.body).pipe(res);
    }
};
exports.FinanceInvoiceFilesController = FinanceInvoiceFilesController;
__decorate([
    (0, common_1.Post)(':id/attachments'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', attachments_service_1.MAX_FILES_PER_UPLOAD, { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String]),
    __metadata("design:returntype", Promise)
], FinanceInvoiceFilesController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(':id/attachments/link'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_task_dto_1.AddLinkDto, String]),
    __metadata("design:returntype", Promise)
], FinanceInvoiceFilesController.prototype, "link", null);
__decorate([
    (0, common_1.Delete)(':id/attachments/:attId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], FinanceInvoiceFilesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/attachments/:attId/content'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Query)('thumb')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], FinanceInvoiceFilesController.prototype, "content", null);
exports.FinanceInvoiceFilesController = FinanceInvoiceFilesController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('finance-invoices'),
    __metadata("design:paramtypes", [invoices_service_1.InvoicesService,
        financials_service_1.FinancialsService,
        auth_service_1.AuthService,
        attachments_service_1.AttachmentsService,
        manpower_access_service_1.ManpowerAccess])
], FinanceInvoiceFilesController);
//# sourceMappingURL=finance.controller.js.map