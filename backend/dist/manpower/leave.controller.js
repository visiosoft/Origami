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
exports.LeaveController = exports.YearDto = exports.CarryForwardDto = exports.AdjustDto = exports.NoteDto = exports.LeaveRequestDto = exports.HolidayDto = exports.LeaveTypeDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const manpower_access_service_1 = require("./manpower-access.service");
const leave_service_1 = require("./leave.service");
class LeaveTypeDto {
}
exports.LeaveTypeDto = LeaveTypeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], LeaveTypeDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], LeaveTypeDto.prototype, "paid", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], LeaveTypeDto.prototype, "trackBalance", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], LeaveTypeDto.prototype, "annualDays", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], LeaveTypeDto.prototype, "carryForwardMax", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], LeaveTypeDto.prototype, "encashable", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], LeaveTypeDto.prototype, "color", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], LeaveTypeDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], LeaveTypeDto.prototype, "order", void 0);
class HolidayDto {
}
exports.HolidayDto = HolidayDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HolidayDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], HolidayDto.prototype, "name", void 0);
class LeaveRequestDto {
}
exports.LeaveRequestDto = LeaveRequestDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LeaveRequestDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LeaveRequestDto.prototype, "leaveTypeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LeaveRequestDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LeaveRequestDto.prototype, "endDate", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], LeaveRequestDto.prototype, "halfDay", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], LeaveRequestDto.prototype, "reason", void 0);
class NoteDto {
}
exports.NoteDto = NoteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], NoteDto.prototype, "note", void 0);
class AdjustDto {
}
exports.AdjustDto = AdjustDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AdjustDto.prototype, "leaveTypeId", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AdjustDto.prototype, "year", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AdjustDto.prototype, "days", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AdjustDto.prototype, "note", void 0);
class CarryForwardDto {
}
exports.CarryForwardDto = CarryForwardDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CarryForwardDto.prototype, "fromYear", void 0);
class YearDto {
}
exports.YearDto = YearDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], YearDto.prototype, "year", void 0);
let LeaveController = class LeaveController {
    constructor(service, access) {
        this.service = service;
        this.access = access;
    }
    actor(auth) {
        return this.access.actor(auth);
    }
    types() { return this.service.listTypes(); }
    async createType(dto, a) { return this.service.createType(dto, await this.actor(a)); }
    async updateType(id, dto, a) { return this.service.updateType(id, dto, await this.actor(a)); }
    async removeType(id, a) { return this.service.removeType(id, await this.actor(a)); }
    holidays(year) { return this.service.listHolidays(year ? Number(year) : undefined); }
    async addHoliday(dto, a) { return this.service.addHoliday(dto, await this.actor(a)); }
    async usFederal(dto, a) { return this.service.addUsFederalHolidays(dto.year, await this.actor(a)); }
    async removeHoliday(id, a) { return this.service.removeHoliday(id, await this.actor(a)); }
    requests(employeeId, status, from, to) {
        return this.service.findRequests({ employeeId, status, from, to });
    }
    preview(dto) { return this.service.preview(dto); }
    async create(dto, a) { return this.service.createRequest(dto, await this.actor(a)); }
    async approve(id, dto, a) { return this.service.decide(id, 'approved', dto.note, await this.actor(a)); }
    async reject(id, dto, a) { return this.service.decide(id, 'rejected', dto.note, await this.actor(a)); }
    async cancel(id, a) { return this.service.cancel(id, await this.actor(a)); }
    balances(employeeId, year) {
        const y = Number(year) || new Date().getFullYear();
        return employeeId ? this.service.balances(employeeId, y) : this.service.allBalances(y);
    }
    adjustments(employeeId) { return this.service.listAdjustments(employeeId); }
    async adjust(dto, a) { return this.service.adjust(dto, await this.actor(a)); }
    async encash(dto, a) { return this.service.encash(dto, await this.actor(a)); }
    async carryForward(dto, a) { return this.service.carryForward(dto.fromYear, await this.actor(a)); }
    calendar(from, to) { return this.service.calendar(from, to); }
};
exports.LeaveController = LeaveController;
__decorate([
    (0, common_1.Get)('types'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeaveController.prototype, "types", null);
__decorate([
    (0, common_1.Post)('types'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LeaveTypeDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "createType", null);
__decorate([
    (0, common_1.Put)('types/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, LeaveTypeDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "updateType", null);
__decorate([
    (0, common_1.Delete)('types/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "removeType", null);
__decorate([
    (0, common_1.Get)('holidays'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeaveController.prototype, "holidays", null);
__decorate([
    (0, common_1.Post)('holidays'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [HolidayDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "addHoliday", null);
__decorate([
    (0, common_1.Post)('holidays/us-federal'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [YearDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "usFederal", null);
__decorate([
    (0, common_1.Delete)('holidays/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "removeHoliday", null);
__decorate([
    (0, common_1.Get)('requests'),
    __param(0, (0, common_1.Query)('employeeId')),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], LeaveController.prototype, "requests", null);
__decorate([
    (0, common_1.Post)('requests/preview'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LeaveRequestDto]),
    __metadata("design:returntype", void 0)
], LeaveController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('requests'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LeaveRequestDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('requests/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, NoteDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('requests/:id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, NoteDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)('requests/:id/cancel'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)('balances'),
    __param(0, (0, common_1.Query)('employeeId')),
    __param(1, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LeaveController.prototype, "balances", null);
__decorate([
    (0, common_1.Get)('adjustments'),
    __param(0, (0, common_1.Query)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeaveController.prototype, "adjustments", null);
__decorate([
    (0, common_1.Post)('adjustments'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AdjustDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "adjust", null);
__decorate([
    (0, common_1.Post)('encash'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AdjustDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "encash", null);
__decorate([
    (0, common_1.Post)('carry-forward'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CarryForwardDto, String]),
    __metadata("design:returntype", Promise)
], LeaveController.prototype, "carryForward", null);
__decorate([
    (0, common_1.Get)('calendar'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LeaveController.prototype, "calendar", null);
exports.LeaveController = LeaveController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('leave'),
    __metadata("design:paramtypes", [leave_service_1.LeaveService,
        manpower_access_service_1.ManpowerAccess])
], LeaveController);
//# sourceMappingURL=leave.controller.js.map