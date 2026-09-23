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
exports.WeeklyTimesheetsController = exports.TimesheetNoteDto = exports.TimesheetSaveDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const manpower_access_service_1 = require("./manpower-access.service");
const weekly_timesheets_service_1 = require("./weekly-timesheets.service");
class TimesheetSaveDto {
}
exports.TimesheetSaveDto = TimesheetSaveDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TimesheetSaveDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TimesheetSaveDto.prototype, "weekStart", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], TimesheetSaveDto.prototype, "lines", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TimesheetSaveDto.prototype, "notes", void 0);
class TimesheetNoteDto {
}
exports.TimesheetNoteDto = TimesheetNoteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], TimesheetNoteDto.prototype, "note", void 0);
let WeeklyTimesheetsController = class WeeklyTimesheetsController {
    constructor(service, access) {
        this.service = service;
        this.access = access;
    }
    async me(a) { return { employee: await this.service.me(await this.access.actor(a)) }; }
    async week(employeeId, weekStart, a) {
        return this.service.week(employeeId, weekStart, await this.access.actor(a));
    }
    async save(dto, a) { return this.service.save(dto, await this.access.actor(a)); }
    async list(from, to, status, employeeId, a) {
        return this.service.list({ from, to, status, employeeId }, await this.access.actor(a));
    }
    async submit(id, a) { return this.service.submit(id, await this.access.actor(a)); }
    async approve(id, dto, a) { return this.service.approve(id, dto.note, await this.access.actor(a)); }
    async reject(id, dto, a) { return this.service.reject(id, dto.note, await this.access.actor(a)); }
    async reopen(id, dto, a) { return this.service.reopen(id, dto.note, await this.access.actor(a)); }
    async remove(id, a) { return this.service.remove(id, await this.access.actor(a)); }
};
exports.WeeklyTimesheetsController = WeeklyTimesheetsController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WeeklyTimesheetsController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('week'),
    __param(0, (0, common_1.Query)('employeeId')),
    __param(1, (0, common_1.Query)('weekStart')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], WeeklyTimesheetsController.prototype, "week", null);
__decorate([
    (0, common_1.Put)('week'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TimesheetSaveDto, String]),
    __metadata("design:returntype", Promise)
], WeeklyTimesheetsController.prototype, "save", null);
__decorate([
    (0, common_1.Get)('list'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('employeeId')),
    __param(4, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], WeeklyTimesheetsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WeeklyTimesheetsController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TimesheetNoteDto, String]),
    __metadata("design:returntype", Promise)
], WeeklyTimesheetsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TimesheetNoteDto, String]),
    __metadata("design:returntype", Promise)
], WeeklyTimesheetsController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/reopen'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, TimesheetNoteDto, String]),
    __metadata("design:returntype", Promise)
], WeeklyTimesheetsController.prototype, "reopen", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], WeeklyTimesheetsController.prototype, "remove", null);
exports.WeeklyTimesheetsController = WeeklyTimesheetsController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('timesheets'),
    __metadata("design:paramtypes", [weekly_timesheets_service_1.WeeklyTimesheetsService, manpower_access_service_1.ManpowerAccess])
], WeeklyTimesheetsController);
//# sourceMappingURL=weekly-timesheets.controller.js.map