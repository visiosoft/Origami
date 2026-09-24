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
exports.SharedWithVendorFilesController = exports.PortalAccessController = exports.PortalController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const stream_1 = require("stream");
const claims_decorator_1 = require("../auth/guards/claims.decorator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const auth_service_1 = require("../auth/auth.service");
const attachments_service_1 = require("../google/attachments.service");
const manpower_access_service_1 = require("../manpower/manpower-access.service");
const financials_service_1 = require("./financials.service");
const finance_controller_1 = require("./finance.controller");
const portal_service_1 = require("./portal.service");
const stream = async (attachments, att, thumb, res) => {
    const file = await attachments.download(att, thumb);
    const inline = attachments_service_1.AttachmentsService.inlineSafe(file.mimeType);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    stream_1.Readable.fromWeb(file.body).pipe(res);
};
let PortalController = class PortalController {
    constructor(portal, attachments) {
        this.portal = portal;
        this.attachments = attachments;
    }
    overview(c) { return this.portal.overview(c); }
    subcontract(id, c) { return this.portal.subcontract(c, id); }
    invoices(c) { return this.portal.invoices(c); }
    submit(dto, c) { return this.portal.submit(c, dto || {}); }
    attach(batchId, files, c) {
        return this.portal.attachToInvoice(c, batchId, files, { name: c?.name || 'Subcontractor', id: c?.sub });
    }
    async billFile(entryId, attId, thumb, c, res) {
        await stream(this.attachments, await this.portal.file(c, { entryId }, attId), thumb === '1', res);
    }
    async sharedFile(id, attId, thumb, c, res) {
        await stream(this.attachments, await this.portal.file(c, { subcontractId: id }, attId), thumb === '1', res);
    }
};
exports.PortalController = PortalController;
__decorate([
    (0, common_1.Get)('overview'),
    __param(0, (0, claims_decorator_1.Claims)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PortalController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('subcontracts/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, claims_decorator_1.Claims)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PortalController.prototype, "subcontract", null);
__decorate([
    (0, common_1.Get)('invoices'),
    __param(0, (0, claims_decorator_1.Claims)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PortalController.prototype, "invoices", null);
__decorate([
    (0, common_1.Post)('invoices'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, claims_decorator_1.Claims)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PortalController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)('invoices/:batchId/attachments'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', attachments_service_1.MAX_FILES_PER_UPLOAD, { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.Param)('batchId')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, claims_decorator_1.Claims)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", void 0)
], PortalController.prototype, "attach", null);
__decorate([
    (0, common_1.Get)('bills/:entryId/files/:attId'),
    __param(0, (0, common_1.Param)('entryId')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Query)('thumb')),
    __param(3, (0, claims_decorator_1.Claims)()),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], PortalController.prototype, "billFile", null);
__decorate([
    (0, common_1.Get)('subcontracts/:id/files/:attId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Query)('thumb')),
    __param(3, (0, claims_decorator_1.Claims)()),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], PortalController.prototype, "sharedFile", null);
exports.PortalController = PortalController = __decorate([
    (0, roles_decorator_1.PortalRoute)(),
    (0, common_1.Controller)('portal'),
    __metadata("design:paramtypes", [portal_service_1.PortalService, attachments_service_1.AttachmentsService])
], PortalController);
let PortalAccessController = class PortalAccessController {
    constructor(portal, access) {
        this.portal = portal;
        this.access = access;
    }
    async status(id, a) { return this.portal.access(id, await this.access.actor(a)); }
    async invite(id, dto, a) { return this.portal.invite(id, dto || {}, await this.access.actor(a)); }
    async revoke(id, a) { return this.portal.revoke(id, await this.access.actor(a)); }
};
exports.PortalAccessController = PortalAccessController;
__decorate([
    (0, common_1.Get)(':contractorId'),
    __param(0, (0, common_1.Param)('contractorId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PortalAccessController.prototype, "status", null);
__decorate([
    (0, common_1.Post)(':contractorId/invite'),
    __param(0, (0, common_1.Param)('contractorId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], PortalAccessController.prototype, "invite", null);
__decorate([
    (0, common_1.Post)(':contractorId/revoke'),
    __param(0, (0, common_1.Param)('contractorId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PortalAccessController.prototype, "revoke", null);
exports.PortalAccessController = PortalAccessController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('finance-portal'),
    __metadata("design:paramtypes", [portal_service_1.PortalService, manpower_access_service_1.ManpowerAccess])
], PortalAccessController);
let SharedWithVendorFilesController = class SharedWithVendorFilesController extends finance_controller_1.FinanceFilesBase {
    constructor(portal, fin, auth, attachments, access) {
        super(fin, auth, attachments, access);
        this.portal = portal;
        this.right = 'manageCosts';
    }
    owner() { return this.portal; }
};
exports.SharedWithVendorFilesController = SharedWithVendorFilesController;
exports.SharedWithVendorFilesController = SharedWithVendorFilesController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('finance-commitment-shared'),
    __metadata("design:paramtypes", [portal_service_1.PortalService, financials_service_1.FinancialsService, auth_service_1.AuthService, attachments_service_1.AttachmentsService, manpower_access_service_1.ManpowerAccess])
], SharedWithVendorFilesController);
//# sourceMappingURL=portal.controller.js.map