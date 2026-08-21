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
exports.FileRoomController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const stream_1 = require("stream");
const file_room_service_1 = require("./file-room.service");
const file_room_dto_1 = require("./dto/file-room.dto");
const auth_service_1 = require("../auth/auth.service");
const attachments_service_1 = require("../google/attachments.service");
let FileRoomController = class FileRoomController {
    constructor(service, auth) {
        this.service = service;
        this.auth = auth;
    }
    list(projectId) {
        const pid = Number(projectId);
        return this.service.list(Number.isFinite(pid) && pid > 0 ? pid : undefined);
    }
    async upload(files, projectId, path, auth) {
        let folderPath = [];
        try {
            folderPath = path ? JSON.parse(path) : [];
        }
        catch {
            folderPath = [];
        }
        return this.service.upload(Number(projectId), Array.isArray(folderPath) ? folderPath : [], files, await this.auth.requireActor(auth));
    }
    async content(id, thumb, download, res) {
        const { file, body, mimeType } = await this.service.content(id, thumb === '1');
        const inline = download !== '1' && attachments_service_1.AttachmentsService.inlineSafe(mimeType);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.name)}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        stream_1.Readable.fromWeb(body).pipe(res);
    }
    rename(id, dto) {
        return this.service.rename(id, dto.name);
    }
    markLatest(id) {
        return this.service.markLatest(id);
    }
    remove(id) {
        return this.service.remove(id);
    }
    createFolder(dto) {
        return this.service.createFolder(Number(dto.projectId), dto.path ?? [], dto.name);
    }
    removeFolder(id) {
        return this.service.removeFolder(id);
    }
};
exports.FileRoomController = FileRoomController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FileRoomController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', file_room_service_1.MAX_FILES_PER_UPLOAD, { limits: { fileSize: file_room_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)('projectId')),
    __param(2, (0, common_1.Body)('path')),
    __param(3, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, String, String, String]),
    __metadata("design:returntype", Promise)
], FileRoomController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)('files/:id/content'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('thumb')),
    __param(2, (0, common_1.Query)('download')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], FileRoomController.prototype, "content", null);
__decorate([
    (0, common_1.Put)('files/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, file_room_dto_1.RenameFileDto]),
    __metadata("design:returntype", void 0)
], FileRoomController.prototype, "rename", null);
__decorate([
    (0, common_1.Put)('files/:id/latest'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FileRoomController.prototype, "markLatest", null);
__decorate([
    (0, common_1.Delete)('files/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FileRoomController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('folders'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [file_room_dto_1.CreateFolderDto]),
    __metadata("design:returntype", void 0)
], FileRoomController.prototype, "createFolder", null);
__decorate([
    (0, common_1.Delete)('folders/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FileRoomController.prototype, "removeFolder", null);
exports.FileRoomController = FileRoomController = __decorate([
    (0, common_1.Controller)('file-room'),
    __metadata("design:paramtypes", [file_room_service_1.FileRoomService,
        auth_service_1.AuthService])
], FileRoomController);
//# sourceMappingURL=file-room.controller.js.map