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
exports.LeadFilesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const stream_1 = require("stream");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const auth_service_1 = require("../auth/auth.service");
const attachments_service_1 = require("../google/attachments.service");
const lead_files_service_1 = require("./lead-files.service");
const client_welcome_service_1 = require("./client-welcome.service");
const all_files_service_1 = require("./all-files.service");
let LeadFilesController = class LeadFilesController {
    constructor(files, auth, attachments, welcome, all) {
        this.files = files;
        this.auth = auth;
        this.attachments = attachments;
        this.welcome = welcome;
        this.all = all;
    }
    allForProject(projectId) {
        return this.all.forProject(Number(projectId));
    }
    allForLead(leadId) {
        return this.all.forLead(leadId);
    }
    welcomeStatus(leadId) {
        return this.welcome.status(leadId);
    }
    async sendWelcome(leadId, dto, a) {
        return this.welcome.send(leadId, dto || {}, await this.auth.requireActor(a));
    }
    disableLink(leadId) {
        return this.welcome.disable(leadId);
    }
    list(leadId) {
        return this.files.list(leadId);
    }
    async upload(leadId, files, stage, stageName, a) {
        return this.files.addAttachments(leadId, files, await this.auth.requireActor(a), stage, stageName);
    }
    async link(leadId, dto, a) {
        return this.files.addLink(leadId, dto.name ?? '', dto.url, await this.auth.actor(a), dto.stage, dto.stageName);
    }
    remove(leadId, attId) {
        return this.files.removeAttachment(leadId, attId);
    }
    async content(leadId, attId, thumb, res) {
        const att = await this.files.attachment(leadId, attId);
        const file = await this.attachments.download(att, thumb === '1');
        const inline = attachments_service_1.AttachmentsService.inlineSafe(file.mimeType);
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        stream_1.Readable.fromWeb(file.body).pipe(res);
    }
};
exports.LeadFilesController = LeadFilesController;
__decorate([
    (0, common_1.Get)('project/:projectId/all'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadFilesController.prototype, "allForProject", null);
__decorate([
    (0, common_1.Get)(':leadId/all'),
    __param(0, (0, common_1.Param)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadFilesController.prototype, "allForLead", null);
__decorate([
    (0, common_1.Get)(':leadId/welcome'),
    __param(0, (0, common_1.Param)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadFilesController.prototype, "welcomeStatus", null);
__decorate([
    (0, common_1.Post)(':leadId/welcome'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], LeadFilesController.prototype, "sendWelcome", null);
__decorate([
    (0, common_1.Post)(':leadId/welcome/disable'),
    __param(0, (0, common_1.Param)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadFilesController.prototype, "disableLink", null);
__decorate([
    (0, common_1.Get)(':leadId'),
    __param(0, (0, common_1.Param)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeadFilesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':leadId/attachments'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', attachments_service_1.MAX_FILES_PER_UPLOAD, { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Query)('stage')),
    __param(3, (0, common_1.Query)('stageName')),
    __param(4, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String, String, String]),
    __metadata("design:returntype", Promise)
], LeadFilesController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(':leadId/attachments/link'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], LeadFilesController.prototype, "link", null);
__decorate([
    (0, common_1.Delete)(':leadId/attachments/:attId'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, common_1.Param)('attId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LeadFilesController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':leadId/attachments/:attId/content'),
    __param(0, (0, common_1.Param)('leadId')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Query)('thumb')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], LeadFilesController.prototype, "content", null);
exports.LeadFilesController = LeadFilesController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('lead-files'),
    __metadata("design:paramtypes", [lead_files_service_1.LeadFilesService,
        auth_service_1.AuthService,
        attachments_service_1.AttachmentsService,
        client_welcome_service_1.ClientWelcomeService,
        all_files_service_1.AllFilesService])
], LeadFilesController);
//# sourceMappingURL=lead-files.controller.js.map