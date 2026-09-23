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
exports.SubcontractorTradesController = exports.SubcontractorTradeDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const manpower_access_service_1 = require("./manpower-access.service");
const subcontractor_trades_service_1 = require("./subcontractor-trades.service");
class SubcontractorTradeDto {
}
exports.SubcontractorTradeDto = SubcontractorTradeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubcontractorTradeDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubcontractorTradeDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubcontractorTradeDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubcontractorTradeDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], SubcontractorTradeDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], SubcontractorTradeDto.prototype, "order", void 0);
let SubcontractorTradesController = class SubcontractorTradesController {
    constructor(service, access) {
        this.service = service;
        this.access = access;
    }
    list() { return this.service.findAll(); }
    async create(dto, a) { return this.service.create(dto, await this.access.actor(a)); }
    async update(id, dto, a) { return this.service.update(id, dto, await this.access.actor(a)); }
    async remove(id, a) { return this.service.remove(id, await this.access.actor(a)); }
};
exports.SubcontractorTradesController = SubcontractorTradesController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SubcontractorTradesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SubcontractorTradeDto, String]),
    __metadata("design:returntype", Promise)
], SubcontractorTradesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, SubcontractorTradeDto, String]),
    __metadata("design:returntype", Promise)
], SubcontractorTradesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SubcontractorTradesController.prototype, "remove", null);
exports.SubcontractorTradesController = SubcontractorTradesController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('subcontractor-trades'),
    __metadata("design:paramtypes", [subcontractor_trades_service_1.SubcontractorTradesService, manpower_access_service_1.ManpowerAccess])
], SubcontractorTradesController);
//# sourceMappingURL=subcontractor-trades.controller.js.map