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
exports.WorkforceRequestsController = exports.AllocateDto = exports.DecisionDto = exports.WorkforceRequestDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const auth_service_1 = require("../auth/auth.service");
const workforce_requests_service_1 = require("./workforce-requests.service");
class WorkforceRequestDto {
}
exports.WorkforceRequestDto = WorkforceRequestDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], WorkforceRequestDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkforceRequestDto.prototype, "workArea", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkforceRequestDto.prototype, "requiredDate", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], WorkforceRequestDto.prototype, "durationDays", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], WorkforceRequestDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WorkforceRequestDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], WorkforceRequestDto.prototype, "submit", void 0);
class DecisionDto {
}
exports.DecisionDto = DecisionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DecisionDto.prototype, "note", void 0);
class AllocateDto {
}
exports.AllocateDto = AllocateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AllocateDto.prototype, "lineId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], AllocateDto.prototype, "employeeIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AllocateDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AllocateDto.prototype, "workArea", void 0);
let WorkforceRequestsController = class WorkforceRequestsController {
    constructor(service, auth) {
        this.service = service;
        this.auth = auth;
    }
    findAll(projectId, status) {
        return this.service.findAll({ projectId: projectId ? Number(projectId) : undefined, status });
    }
    findOne(id) {
        return this.service.findOne(id);
    }
    async create(dto, auth) {
        return this.service.create(dto, await this.auth.actor(auth));
    }
    update(id, dto) {
        return this.service.update(id, dto);
    }
    remove(id) {
        return this.service.remove(id);
    }
    submit(id) {
        return this.service.submit(id);
    }
    async approve(id, dto, auth) {
        return this.service.approve(id, dto.note, await this.auth.actor(auth));
    }
    async reject(id, dto, auth) {
        return this.service.reject(id, dto.note, await this.auth.actor(auth));
    }
    async cancel(id, auth) {
        return this.service.cancel(id, await this.auth.actor(auth));
    }
    async fulfill(id, auth) {
        return this.service.fulfill(id, await this.auth.actor(auth));
    }
    async allocate(id, dto, auth) {
        return this.service.allocate(id, dto, await this.auth.actor(auth));
    }
};
exports.WorkforceRequestsController = WorkforceRequestsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], WorkforceRequestsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkforceRequestsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [WorkforceRequestDto, String]),
    __metadata("design:returntype", Promise)
], WorkforceRequestsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, WorkforceRequestDto]),
    __metadata("design:returntype", void 0)
], WorkforceRequestsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkforceRequestsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], WorkforceRequestsController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, DecisionDto, String]),
    __metadata("design:returntype", Promise)
], WorkforceRequestsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, DecisionDto, String]),
    __metadata("design:returntype", Promise)
], WorkforceRequestsController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WorkforceRequestsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/fulfill'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WorkforceRequestsController.prototype, "fulfill", null);
__decorate([
    (0, common_1.Post)(':id/allocate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AllocateDto, String]),
    __metadata("design:returntype", Promise)
], WorkforceRequestsController.prototype, "allocate", null);
exports.WorkforceRequestsController = WorkforceRequestsController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('workforce-requests'),
    __metadata("design:paramtypes", [workforce_requests_service_1.WorkforceRequestsService,
        auth_service_1.AuthService])
], WorkforceRequestsController);
//# sourceMappingURL=workforce-requests.controller.js.map