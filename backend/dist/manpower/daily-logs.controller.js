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
const daily_log_backup_service_1 = require("./daily-log-backup.service");
const daily_report_automation_service_1 = require("./daily-report-automation.service");
const weekly_report_service_1 = require("./weekly-report.service");
const daily_log_dto_1 = require("./dto/daily-log.dto");
let DailyLogsController = class DailyLogsController {
    constructor(service, auth, backup, automation, weekly) {
        this.service = service;
        this.auth = auth;
        this.backup = backup;
        this.automation = automation;
        this.weekly = weekly;
    }
    findAll(status, projectId) {
        return this.service.findAllLogs({ status, projectId: projectId != null ? Number(projectId) : undefined });
    }
    getForDay(projectId, date, id) {
        return this.service.getForDay(Number(projectId), date, id || undefined);
    }
    weeklyReport(projectId, week) {
        return this.weekly.week(Number(projectId), week || '');
    }
    emailWeekly(body) {
        const to = String(body?.to || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
        return this.weekly.email(Number(body?.projectId), String(body?.week || ''), to.length ? to : undefined);
    }
    templates() {
        return this.service.listTemplates();
    }
    async saveTemplate(dto, auth) {
        return this.service.saveTemplate(dto, await this.auth.actor(auth));
    }
    async removeTemplate(id, auth) {
        return this.service.removeTemplate(id, await this.auth.actor(auth));
    }
    async save(dto, auth) {
        return this.service.save(dto, await this.auth.actor(auth));
    }
    async submit(id, auth) {
        const actor = await this.auth.actor(auth);
        const log = await this.service.submit(id, actor);
        const auto = await this.automation.afterSubmit(log.id, actor).catch(() => ({ held: false, created: 0 }));
        this.backup.afterSubmit(log.id);
        if (log.onBehalfOf) {
            const to = await this.service.ownerEmail(log).catch(() => null);
            if (to)
                this.backup.send(log.id, [to]).catch(() => undefined);
        }
        return { ...log, projectHeld: auto.held, autoReportsMade: auto.created };
    }
    email(id, body) {
        const to = String(body?.to || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
        return this.backup.send(id, to.length ? to : undefined);
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
    __param(2, (0, common_1.Query)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DailyLogsController.prototype, "getForDay", null);
__decorate([
    (0, common_1.Get)('weekly'),
    __param(0, (0, common_1.Query)('projectId')),
    __param(1, (0, common_1.Query)('week')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DailyLogsController.prototype, "weeklyReport", null);
__decorate([
    (0, common_1.Post)('weekly/email'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DailyLogsController.prototype, "emailWeekly", null);
__decorate([
    (0, common_1.Get)('templates'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DailyLogsController.prototype, "templates", null);
__decorate([
    (0, common_1.Post)('templates'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [daily_log_dto_1.SaveDailyReportTemplateDto, String]),
    __metadata("design:returntype", Promise)
], DailyLogsController.prototype, "saveTemplate", null);
__decorate([
    (0, common_1.Delete)('templates/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], DailyLogsController.prototype, "removeTemplate", null);
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
    (0, common_1.Post)(':id/email'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DailyLogsController.prototype, "email", null);
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
        auth_service_1.AuthService,
        daily_log_backup_service_1.DailyLogBackupService,
        daily_report_automation_service_1.DailyReportAutomationService,
        weekly_report_service_1.WeeklyReportService])
], DailyLogsController);
//# sourceMappingURL=daily-logs.controller.js.map