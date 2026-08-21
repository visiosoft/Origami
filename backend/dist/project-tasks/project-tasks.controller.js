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
exports.ProjectTasksController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const stream_1 = require("stream");
const project_tasks_service_1 = require("./project-tasks.service");
const create_project_task_dto_1 = require("./dto/create-project-task.dto");
const update_task_dto_1 = require("../tasks/dto/update-task.dto");
const auth_service_1 = require("../auth/auth.service");
const attachments_service_1 = require("../google/attachments.service");
const viewer_util_1 = require("../database/viewer.util");
let ProjectTasksController = class ProjectTasksController {
    constructor(service, auth, attachments) {
        this.service = service;
        this.auth = auth;
        this.attachments = attachments;
    }
    async findAll(projectId, auth) {
        const rows = await this.service.findAll(projectId ? Number(projectId) : undefined);
        return (0, viewer_util_1.scopeTasks)(rows, await this.auth.verify(auth));
    }
    async board(projectId, auth) {
        const pid = Number(projectId);
        if (!Number.isFinite(pid))
            return { sections: [], tasks: [] };
        const { sections, tasks } = await this.service.board(pid);
        return { sections, tasks: (0, viewer_util_1.scopeTasks)(tasks, await this.auth.verify(auth)) };
    }
    reorder(dto) {
        return this.service.reorder(dto.sectionId, dto.ids ?? []);
    }
    async create(dto, auth) {
        return this.service.create(dto, await this.auth.actor(auth));
    }
    async update(id, dto, auth) {
        return this.service.update(id, dto, await this.auth.actor(auth));
    }
    remove(id) {
        return this.service.remove(id);
    }
    async upload(id, files, auth) {
        return this.service.addAttachments(id, files, await this.auth.requireActor(auth));
    }
    async link(id, dto, auth) {
        return this.service.addLink(id, dto.name ?? '', dto.url, await this.auth.actor(auth));
    }
    async removeAttachment(id, attId, auth) {
        return this.service.removeAttachment(id, attId, await this.auth.actor(auth));
    }
    async content(id, attId, thumb, res) {
        const att = await this.service.attachment(id, attId);
        const file = await this.attachments.download(att, thumb === '1');
        const inline = attachments_service_1.AttachmentsService.inlineSafe(file.mimeType);
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(att.name)}"`);
        res.setHeader('Cache-Control', 'private, max-age=300');
        stream_1.Readable.fromWeb(file.body).pipe(res);
    }
    async comment(id, dto, auth) {
        return this.service.addComment(id, dto.text, await this.auth.actor(auth));
    }
};
exports.ProjectTasksController = ProjectTasksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProjectTasksController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('board'),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProjectTasksController.prototype, "board", null);
__decorate([
    (0, common_1.Put)('reorder'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_project_task_dto_1.ReorderDto]),
    __metadata("design:returntype", void 0)
], ProjectTasksController.prototype, "reorder", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_project_task_dto_1.CreateProjectTaskDto, String]),
    __metadata("design:returntype", Promise)
], ProjectTasksController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ProjectTasksController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectTasksController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/attachments'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', attachments_service_1.MAX_FILES_PER_UPLOAD, { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String]),
    __metadata("design:returntype", Promise)
], ProjectTasksController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(':id/attachments/link'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_task_dto_1.AddLinkDto, String]),
    __metadata("design:returntype", Promise)
], ProjectTasksController.prototype, "link", null);
__decorate([
    (0, common_1.Delete)(':id/attachments/:attId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProjectTasksController.prototype, "removeAttachment", null);
__decorate([
    (0, common_1.Get)(':id/attachments/:attId/content'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Query)('thumb')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ProjectTasksController.prototype, "content", null);
__decorate([
    (0, common_1.Post)(':id/comments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_task_dto_1.AddCommentDto, String]),
    __metadata("design:returntype", Promise)
], ProjectTasksController.prototype, "comment", null);
exports.ProjectTasksController = ProjectTasksController = __decorate([
    (0, common_1.Controller)('project-tasks'),
    __metadata("design:paramtypes", [project_tasks_service_1.ProjectTasksService,
        auth_service_1.AuthService,
        attachments_service_1.AttachmentsService])
], ProjectTasksController);
//# sourceMappingURL=project-tasks.controller.js.map