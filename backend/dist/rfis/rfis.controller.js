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
exports.RfisController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const stream_1 = require("stream");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const auth_service_1 = require("../auth/auth.service");
const attachments_service_1 = require("../google/attachments.service");
const manpower_access_service_1 = require("../manpower/manpower-access.service");
const update_task_dto_1 = require("../tasks/dto/update-task.dto");
const rfis_service_1 = require("./rfis.service");
const claims_decorator_1 = require("../auth/guards/claims.decorator");
let RfisController = class RfisController {
    constructor(rfis, access, auth, attachments) {
        this.rfis = rfis;
        this.access = access;
        this.auth = auth;
        this.attachments = attachments;
    }
    actor(a) { return this.access.actor(a); }
    async rights(a) {
        return this.rfis.rights(await this.actor(a));
    }
    async list(projectId, a) {
        const id = Number(projectId);
        return this.rfis.list(await this.actor(a), Number.isFinite(id) && id > 0 ? id : undefined);
    }
    async get(id, a) {
        return this.rfis.get(id, await this.actor(a));
    }
    async pdf(id, download, res, claims) {
        if (!claims)
            throw new common_1.ForbiddenException('Sign in first.');
        const { buffer, filename } = await this.rfis.pdf(id, { id: claims.sub, name: claims.name, roleKey: claims.roleKey });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${download === '1' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(filename)}"`);
        res.send(buffer);
    }
    async create(dto, a) {
        return this.rfis.create(dto, await this.actor(a));
    }
    async update(id, dto, a) {
        return this.rfis.update(id, dto, await this.actor(a));
    }
    async remove(id, a) {
        return this.rfis.remove(id, await this.actor(a));
    }
    async send(id, dto, a) {
        return this.rfis.send(id, dto || {}, await this.actor(a));
    }
    async markSent(id, a) {
        return this.rfis.markSent(id, await this.actor(a));
    }
    async answer(id, dto, a) {
        return this.rfis.answer(id, dto || {}, await this.actor(a));
    }
    async close(id, dto, a) {
        return this.rfis.close(id, dto || {}, await this.actor(a));
    }
    async reopen(id, a) {
        return this.rfis.reopen(id, await this.actor(a));
    }
    async void(id, dto, a) {
        return this.rfis.void(id, dto || {}, await this.actor(a));
    }
    async manage(a) {
        if (!(await this.rfis.rights(await this.actor(a))).manage)
            throw new common_1.ForbiddenException("Your role doesn't allow changing RFIs.");
    }
    async upload(id, files, a) {
        await this.manage(a);
        return this.rfis.addAttachments(id, files, await this.auth.requireActor(a));
    }
    async link(id, dto, a) {
        await this.manage(a);
        return this.rfis.addLink(id, dto.name ?? '', dto.url, await this.auth.actor(a));
    }
    async removeAttachment(id, attId, a) {
        await this.manage(a);
        return this.rfis.removeAttachment(id, attId);
    }
    async content(id, attId, thumb, res) {
        const att = await this.rfis.attachment(id, attId);
        const file = await this.attachments.download(att, thumb === '1');
        const inline = attachments_service_1.AttachmentsService.inlineSafe(file.mimeType);
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        stream_1.Readable.fromWeb(file.body).pipe(res);
    }
};
exports.RfisController = RfisController;
__decorate([
    (0, common_1.Get)('access'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "rights", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':id/pdf'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('download')),
    __param(2, (0, common_1.Res)()),
    __param(3, (0, claims_decorator_1.Claims)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "pdf", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/send'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "send", null);
__decorate([
    (0, common_1.Post)(':id/mark-sent'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "markSent", null);
__decorate([
    (0, common_1.Post)(':id/answer'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "answer", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "close", null);
__decorate([
    (0, common_1.Post)(':id/reopen'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "reopen", null);
__decorate([
    (0, common_1.Post)(':id/void'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "void", null);
__decorate([
    (0, common_1.Post)(':id/attachments'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', attachments_service_1.MAX_FILES_PER_UPLOAD, { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(':id/attachments/link'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_task_dto_1.AddLinkDto, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "link", null);
__decorate([
    (0, common_1.Delete)(':id/attachments/:attId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "removeAttachment", null);
__decorate([
    (0, common_1.Get)(':id/attachments/:attId/content'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Query)('thumb')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], RfisController.prototype, "content", null);
exports.RfisController = RfisController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('rfis'),
    __metadata("design:paramtypes", [rfis_service_1.RfisService,
        manpower_access_service_1.ManpowerAccess,
        auth_service_1.AuthService,
        attachments_service_1.AttachmentsService])
], RfisController);
//# sourceMappingURL=rfis.controller.js.map