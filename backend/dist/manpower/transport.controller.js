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
exports.TransportController = exports.RiderEndDto = exports.RiderDto = exports.RouteDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const manpower_access_service_1 = require("./manpower-access.service");
const transport_service_1 = require("./transport.service");
class RouteDto {
}
exports.RouteDto = RouteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RouteDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RouteDto.prototype, "vehicle", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RouteDto.prototype, "capacity", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RouteDto.prototype, "driverEmployeeId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RouteDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RouteDto.prototype, "departureTime", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RouteDto.prototype, "returnTime", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], RouteDto.prototype, "pickupPoints", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RouteDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RouteDto.prototype, "notes", void 0);
class RiderDto {
}
exports.RiderDto = RiderDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RiderDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RiderDto.prototype, "pickupPoint", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RiderDto.prototype, "startDate", void 0);
class RiderEndDto {
}
exports.RiderEndDto = RiderEndDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RiderEndDto.prototype, "date", void 0);
let TransportController = class TransportController {
    constructor(service, access) {
        this.service = service;
        this.access = access;
    }
    list() { return this.service.list(); }
    history(id) { return this.service.history(id); }
    async create(dto, a) { return this.service.create(dto, await this.access.actor(a)); }
    async update(id, dto, a) { return this.service.update(id, dto, await this.access.actor(a)); }
    async remove(id, a) { return this.service.remove(id, await this.access.actor(a)); }
    async addRider(id, dto, a) { return this.service.addRider(id, dto, await this.access.actor(a)); }
    async end(id, dto, a) { return this.service.endRider(id, dto.date, await this.access.actor(a)); }
};
exports.TransportController = TransportController;
__decorate([
    (0, common_1.Get)('routes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TransportController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('employee/:employeeId'),
    __param(0, (0, common_1.Param)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TransportController.prototype, "history", null);
__decorate([
    (0, common_1.Post)('routes'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RouteDto, String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "create", null);
__decorate([
    (0, common_1.Put)('routes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, RouteDto, String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)('routes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('routes/:id/riders'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, RiderDto, String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "addRider", null);
__decorate([
    (0, common_1.Post)('riders/:id/end'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, RiderEndDto, String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "end", null);
exports.TransportController = TransportController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('transport'),
    __metadata("design:paramtypes", [transport_service_1.TransportService, manpower_access_service_1.ManpowerAccess])
], TransportController);
//# sourceMappingURL=transport.controller.js.map