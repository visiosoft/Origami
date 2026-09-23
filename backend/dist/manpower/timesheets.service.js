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
exports.TimesheetsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let TimesheetsService = class TimesheetsService {
    constructor(logs, entries, projects) {
        this.logs = logs;
        this.entries = entries;
        this.projects = projects;
    }
    async forEmployee(employeeId, from, to) {
        const logsInRange = await this.logs
            .createQueryBuilder('log')
            .where('log.date >= :from AND log.date <= :to', { from, to })
            .getMany();
        if (!logsInRange.length)
            return { rows: [], totalHours: 0 };
        const byLogId = new Map(logsInRange.map((l) => [l.id, l]));
        const allEntries = await this.entries.find({ where: logsInRange.map((l) => ({ dailyLogId: l.id })) });
        const mine = allEntries.filter((e) => e.employeeId === employeeId);
        if (!mine.length)
            return { rows: [], totalHours: 0 };
        const projectIds = Array.from(new Set(mine.map((e) => byLogId.get(e.dailyLogId)?.projectId).filter((x) => x != null)));
        const projects = projectIds.length ? await this.projects.findBy(projectIds.map((id) => ({ id }))) : [];
        const projectName = new Map(projects.map((p) => [p.id, p.name]));
        const rows = mine.map((e) => {
            const log = byLogId.get(e.dailyLogId);
            return {
                date: log.date,
                projectId: log.projectId,
                projectName: projectName.get(log.projectId) || `Project ${log.projectId}`,
                csiCodeId: e.csiCodeId,
                hours: e.hours || 0,
                taskDetail: e.taskDetail,
                status: log.status,
            };
        }).sort((a, b) => a.date.localeCompare(b.date));
        const totalHours = rows.reduce((sum, r) => sum + (r.hours || 0), 0);
        return { rows, totalHours };
    }
};
exports.TimesheetsService = TimesheetsService;
exports.TimesheetsService = TimesheetsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.DailyLogEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.LaborLogEntryEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.ProjectEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], TimesheetsService);
//# sourceMappingURL=timesheets.service.js.map