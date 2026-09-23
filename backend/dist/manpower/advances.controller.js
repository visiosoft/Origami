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
exports.AdvancesController = exports.RepayDto = exports.DisburseDto = exports.AdvanceDecisionDto = exports.AdvanceDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const manpower_access_service_1 = require("./manpower-access.service");
const advances_service_1 = require("./advances.service");
class AdvanceDto {
}
exports.AdvanceDto = AdvanceDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdvanceDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['salary_advance', 'emergency_advance', 'loan', 'travel_advance', 'project_advance']),
    __metadata("design:type", String)
], AdvanceDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AdvanceDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], AdvanceDto.prototype, "installments", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdvanceDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdvanceDto.prototype, "requestDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdvanceDto.prototype, "deductionStart", void 0);
class AdvanceDecisionDto {
}
exports.AdvanceDecisionDto = AdvanceDecisionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdvanceDecisionDto.prototype, "note", void 0);
class DisburseDto {
}
exports.DisburseDto = DisburseDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DisburseDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DisburseDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], DisburseDto.prototype, "ref", void 0);
class RepayDto {
}
exports.RepayDto = RepayDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RepayDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RepayDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RepayDto.prototype, "note", void 0);
let AdvancesController = class AdvancesController {
    constructor(service, access) {
        this.service = service;
        this.access = access;
    }
    findAll(employeeId, status) {
        return this.service.findAll({ employeeId, status });
    }
    async create(dto, auth) {
        return this.service.create(dto, await this.access.actor(auth));
    }
    async approve(id, dto, auth) {
        return this.service.decide(id, 'approved', dto.note, await this.access.actor(auth));
    }
    async reject(id, dto, auth) {
        return this.service.decide(id, 'rejected', dto.note, await this.access.actor(auth));
    }
    async cancel(id, auth) {
        return this.service.cancel(id, await this.access.actor(auth));
    }
    async disburse(id, dto, auth) {
        return this.service.disburse(id, dto, await this.access.actor(auth));
    }
    async repay(id, dto, auth) {
        return this.service.repay(id, dto, await this.access.actor(auth));
    }
};
exports.AdvancesController = AdvancesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('employeeId')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdvancesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AdvanceDto, String]),
    __metadata("design:returntype", Promise)
], AdvancesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AdvanceDecisionDto, String]),
    __metadata("design:returntype", Promise)
], AdvancesController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, AdvanceDecisionDto, String]),
    __metadata("design:returntype", Promise)
], AdvancesController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdvancesController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/disburse'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, DisburseDto, String]),
    __metadata("design:returntype", Promise)
], AdvancesController.prototype, "disburse", null);
__decorate([
    (0, common_1.Post)(':id/repay'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, RepayDto, String]),
    __metadata("design:returntype", Promise)
], AdvancesController.prototype, "repay", null);
exports.AdvancesController = AdvancesController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('advances'),
    __metadata("design:paramtypes", [advances_service_1.AdvancesService,
        manpower_access_service_1.ManpowerAccess])
], AdvancesController);
//# sourceMappingURL=advances.controller.js.map