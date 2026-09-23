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
exports.DailyLogsController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const auth_service_1 = require("../auth/auth.service");
const daily_logs_service_1 = require("./daily-logs.service");
const daily_log_dto_1 = require("./dto/daily-log.dto");
let DailyLogsController = class DailyLogsController {
    constructor(service, auth) {
        this.service = service;
        this.auth = auth;
    }
    findAll(status, projectId) {
        return this.service.findAllLogs({ status, projectId: projectId != null ? Number(projectId) : undefined });
    }
    getForDay(projectId, date) {
        return this.service.getForDay(Number(projectId), date);
    }
    async save(dto, auth) {
        return this.service.save(dto, await this.auth.actor(auth));
    }
    async submit(id, auth) {
        return this.service.submit(id, await this.auth.actor(auth));
    }
    async approve(id, auth) {
        return this.service.approve(id, await this.auth.actor(auth));
    }
    async reject(id, dto, auth) {
        return this.service.reject(id, dto.note, await this.auth.actor(auth));
    }
};
exports.DailyLogsController = DailyLogsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DailyLogsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('day'),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DailyLogsController.prototype, "getForDay", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [daily_log_dto_1.SaveDailyLogDto, String]),
    __metadata("design:returntype", Promise)
], DailyLogsController.prototype, "save", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DailyLogsController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DailyLogsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, daily_log_dto_1.RejectDailyLogDto, String]),
    __metadata("design:returntype", Promise)
], DailyLogsController.prototype, "reject", null);
exports.DailyLogsController = DailyLogsController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('daily-logs'),
    __metadata("design:paramtypes", [daily_logs_service_1.DailyLogsService,
        auth_service_1.AuthService])
], DailyLogsController);
//# sourceMappingURL=daily-logs.controller.js.map