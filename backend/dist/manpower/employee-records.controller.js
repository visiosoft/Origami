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
exports.EmployeeRecordsController = exports.EmployeeRecordDto = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const stream_1 = require("stream");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const auth_service_1 = require("../auth/auth.service");
const attachments_service_1 = require("../google/attachments.service");
const update_task_dto_1 = require("../tasks/dto/update-task.dto");
const employee_records_service_1 = require("./employee-records.service");
class EmployeeRecordDto {
}
exports.EmployeeRecordDto = EmployeeRecordDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['document', 'certification', 'contract']),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "number", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "issuer", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "issueDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "expiryDate", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], EmployeeRecordDto.prototype, "rate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "terms", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "verification", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], EmployeeRecordDto.prototype, "notes", void 0);
let EmployeeRecordsController = class EmployeeRecordsController {
    constructor(service, auth, attachments) {
        this.service = service;
        this.auth = auth;
        this.attachments = attachments;
    }
    findAll(employeeId, kind) {
        return this.service.findAll({ employeeId, kind });
    }
    create(dto) {
        return this.service.create(dto);
    }
    update(id, dto) {
        return this.service.update(id, dto);
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
    removeAttachment(id, attId) {
        return this.service.removeAttachment(id, attId);
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
};
exports.EmployeeRecordsController = EmployeeRecordsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('employeeId')),
    __param(1, (0, common_1.Query)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], EmployeeRecordsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EmployeeRecordDto]),
    __metadata("design:returntype", void 0)
], EmployeeRecordsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EmployeeRecordsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EmployeeRecordsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/attachments'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', attachments_service_1.MAX_FILES_PER_UPLOAD, { limits: { fileSize: attachments_service_1.MAX_FILE_BYTES } })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String]),
    __metadata("design:returntype", Promise)
], EmployeeRecordsController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(':id/attachments/link'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_task_dto_1.AddLinkDto, String]),
    __metadata("design:returntype", Promise)
], EmployeeRecordsController.prototype, "link", null);
__decorate([
    (0, common_1.Delete)(':id/attachments/:attId'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], EmployeeRecordsController.prototype, "removeAttachment", null);
__decorate([
    (0, common_1.Get)(':id/attachments/:attId/content'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('attId')),
    __param(2, (0, common_1.Query)('thumb')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], EmployeeRecordsController.prototype, "content", null);
exports.EmployeeRecordsController = EmployeeRecordsController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('employee-records'),
    __metadata("design:paramtypes", [employee_records_service_1.EmployeeRecordsService,
        auth_service_1.AuthService,
        attachments_service_1.AttachmentsService])
], EmployeeRecordsController);
//# sourceMappingURL=employee-records.controller.js.map