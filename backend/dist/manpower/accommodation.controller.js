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
exports.AccommodationController = exports.IssueUpdateDto = exports.IssueReportDto = exports.CheckoutDto = exports.AllocateDto = exports.UnitUpdateDto = exports.UnitDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const manpower_access_service_1 = require("./manpower-access.service");
const accommodation_service_1 = require("./accommodation.service");
class UnitDto {
}
exports.UnitDto = UnitDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UnitDto.prototype, "parentId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UnitDto.prototype, "level", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UnitDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UnitDto.prototype, "count", void 0);
class UnitUpdateDto {
}
exports.UnitUpdateDto = UnitUpdateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UnitUpdateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UnitUpdateDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UnitUpdateDto.prototype, "active", void 0);
class AllocateDto {
}
exports.AllocateDto = AllocateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AllocateDto.prototype, "bedId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AllocateDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AllocateDto.prototype, "checkIn", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AllocateDto.prototype, "notes", void 0);
class CheckoutDto {
}
exports.CheckoutDto = CheckoutDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CheckoutDto.prototype, "date", void 0);
class IssueReportDto {
}
exports.IssueReportDto = IssueReportDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IssueReportDto.prototype, "unitId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IssueReportDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], IssueReportDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], IssueReportDto.prototype, "employeeId", void 0);
class IssueUpdateDto {
}
exports.IssueUpdateDto = IssueUpdateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IssueUpdateDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], IssueUpdateDto.prototype, "resolution", void 0);
let AccommodationController = class AccommodationController {
    constructor(service, access) {
        this.service = service;
        this.access = access;
    }
    overview() { return this.service.overview(); }
    history(id) { return this.service.history(id); }
    async create(dto, a) { return this.service.createUnit(dto, await this.access.actor(a)); }
    async update(id, dto, a) { return this.service.updateUnit(id, dto, await this.access.actor(a)); }
    async remove(id, a) { return this.service.removeUnit(id, await this.access.actor(a)); }
    async allocate(dto, a) { return this.service.allocate(dto, await this.access.actor(a)); }
    async checkout(id, dto, a) { return this.service.checkout(id, dto.date, await this.access.actor(a)); }
    async report(dto, a) { return this.service.reportIssue(dto, await this.access.actor(a)); }
    async updateIssue(id, dto, a) { return this.service.updateIssue(id, dto, await this.access.actor(a)); }
};
exports.AccommodationController = AccommodationController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AccommodationController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId'),
    __param(0, (0, common_1.Param)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AccommodationController.prototype, "history", null);
__decorate([
    (0, common_1.Post)('units'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UnitDto, String]),
    __metadata("design:returntype", Promise)
], AccommodationController.prototype, "create", null);
__decorate([
    (0, common_1.Put)('units/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UnitUpdateDto, String]),
    __metadata("design:returntype", Promise)
], AccommodationController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('units/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AccommodationController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('allocations'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AllocateDto, String]),
    __metadata("design:returntype", Promise)
], AccommodationController.prototype, "allocate", null);
__decorate([
    (0, common_1.Post)('allocations/:id/checkout'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, CheckoutDto, String]),
    __metadata("design:returntype", Promise)
], AccommodationController.prototype, "checkout", null);
__decorate([
    (0, common_1.Post)('issues'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [IssueReportDto, String]),
    __metadata("design:returntype", Promise)
], AccommodationController.prototype, "report", null);
__decorate([
    (0, common_1.Put)('issues/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, IssueUpdateDto, String]),
    __metadata("design:returntype", Promise)
], AccommodationController.prototype, "updateIssue", null);
exports.AccommodationController = AccommodationController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('accommodation'),
    __metadata("design:paramtypes", [accommodation_service_1.AccommodationService, manpower_access_service_1.ManpowerAccess])
], AccommodationController);
//# sourceMappingURL=accommodation.controller.js.map