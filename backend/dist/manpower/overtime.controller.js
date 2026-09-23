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
exports.OvertimeController = exports.DecisionNoteDto = exports.BulkOvertimeDto = exports.OvertimeDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const manpower_access_service_1 = require("./manpower-access.service");
const overtime_service_1 = require("./overtime.service");
class OvertimeDto {
}
exports.OvertimeDto = OvertimeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OvertimeDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], OvertimeDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OvertimeDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OvertimeDto.prototype, "hours", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['normal', 'weekend', 'holiday', 'night']),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], OvertimeDto.prototype, "otType", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], OvertimeDto.prototype, "rate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], OvertimeDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['manual', 'daily_log']),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], OvertimeDto.prototype, "source", void 0);
class BulkOvertimeDto {
}
exports.BulkOvertimeDto = BulkOvertimeDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], BulkOvertimeDto.prototype, "items", void 0);
class DecisionNoteDto {
}
exports.DecisionNoteDto = DecisionNoteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DecisionNoteDto.prototype, "note", void 0);
let OvertimeController = class OvertimeController {
    constructor(service, access) {
        this.service = service;
        this.access = access;
    }
    findAll(employeeId, status, from, to) {
        return this.service.findAll({ employeeId, status, from, to });
    }
    suggestions(from, to) {
        return this.service.suggestions(from, to);
    }
    async create(dto, auth) {
        return this.service.create(dto, await this.access.actor(auth));
    }
    async bulk(dto, auth) {
        return this.service.bulkCreate(dto.items, await this.access.actor(auth));
    }
    async approve(id, dto, auth) {
        return this.service.approve(id, dto.note, await this.access.actor(auth));
    }
    async reject(id, dto, auth) {
        return this.service.reject(id, dto.note, await this.access.actor(auth));
    }
    async cancel(id, auth) {
        return this.service.cancel(id, await this.access.actor(auth));
    }
};
exports.OvertimeController = OvertimeController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('employeeId')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], OvertimeController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('suggestions'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], OvertimeController.prototype, "suggestions", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [OvertimeDto, String]),
    __metadata("design:returntype", Promise)
], OvertimeController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bulk'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BulkOvertimeDto, String]),
    __metadata("design:returntype", Promise)
], OvertimeController.prototype, "bulk", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, DecisionNoteDto, String]),
    __metadata("design:returntype", Promise)
], OvertimeController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, DecisionNoteDto, String]),
    __metadata("design:returntype", Promise)
], OvertimeController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], OvertimeController.prototype, "cancel", null);
exports.OvertimeController = OvertimeController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('overtime'),
    __metadata("design:paramtypes", [overtime_service_1.OvertimeService,
        manpower_access_service_1.ManpowerAccess])
], OvertimeController);
//# sourceMappingURL=overtime.controller.js.map