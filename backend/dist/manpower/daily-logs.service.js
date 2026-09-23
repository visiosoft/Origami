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
exports.DailyLogsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
let DailyLogsService = class DailyLogsService {
    constructor(logs, entries) {
        this.logs = logs;
        this.entries = entries;
    }
    async findEntries(opts) {
        const qb = this.logs.createQueryBuilder('log');
        if (opts.projectId != null)
            qb.andWhere('log.projectId = :projectId', { projectId: opts.projectId });
        if (opts.from)
            qb.andWhere('log.date >= :from', { from: opts.from });
        if (opts.to)
            qb.andWhere('log.date <= :to', { to: opts.to });
        const logs = await qb.getMany();
        if (!logs.length)
            return [];
        const entries = await this.entries.find({ where: logs.map((l) => ({ dailyLogId: l.id })) });
        const byLog = new Map(logs.map((l) => [l.id, l]));
        const filtered = opts.employeeId ? entries.filter((e) => e.employeeId === opts.employeeId) : entries;
        return filtered.map((e) => ({ ...e, dailyLog: byLog.get(e.dailyLogId) }));
    }
    async findAllLogs(opts) {
        const where = {};
        if (opts.status)
            where.status = opts.status;
        if (opts.projectId != null)
            where.projectId = opts.projectId;
        return this.logs.find({ where, order: { date: 'DESC' } });
    }
    async getForDay(projectId, date) {
        const log = await this.logs.findOneBy({ projectId, date });
        const entries = log ? await this.entries.find({ where: { dailyLogId: log.id } }) : [];
        return { log: log ?? { id: null, projectId, date, status: 'draft', notes: '' }, entries };
    }
    async save(dto, actor) {
        let log = await this.logs.findOneBy({ projectId: dto.projectId, date: dto.date });
        if (log && log.status !== 'draft' && log.status !== 'rejected') {
            throw new common_1.BadRequestException('This day has already been submitted -- it can no longer be edited directly.');
        }
        if (!log) {
            log = this.logs.create({
                id: 'DL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
                projectId: dto.projectId, date: dto.date, status: 'draft',
                supervisorId: actor.id, supervisorName: actor.name,
                createdAt: new Date().toISOString(),
            });
        }
        if (log.status === 'rejected')
            log.status = 'draft';
        log.notes = dto.notes ?? log.notes;
        log = await this.logs.save(log);
        const existing = await this.entries.find({ where: { dailyLogId: log.id } });
        if (existing.length)
            await this.entries.remove(existing);
        const rows = (dto.entries || []).map((e, i) => this.entries.create({
            id: 'LLE-' + String(Date.now()) + '-' + i,
            dailyLogId: log.id, employeeId: e.employeeId, csiCodeId: e.csiCodeId,
            hours: e.hours, taskDetail: e.taskDetail, taskStatus: e.taskStatus, team: e.team,
        }));
        const saved = rows.length ? await this.entries.save(rows) : [];
        return { log, entries: saved };
    }
    async submit(id, actor) {
        const log = await this.require(id);
        if (log.status !== 'draft' && log.status !== 'rejected')
            throw new common_1.BadRequestException(`Cannot submit a log in status "${log.status}"`);
        log.status = 'submitted';
        log.submittedAt = new Date().toISOString();
        log.supervisorId = log.supervisorId || actor.id || '';
        log.supervisorName = log.supervisorName || actor.name;
        log.rejectionNote = null;
        return this.logs.save(log);
    }
    async approve(id, actor) {
        const log = await this.require(id);
        if (log.status !== 'submitted')
            throw new common_1.BadRequestException(`Cannot approve a log in status "${log.status}"`);
        if (actor.id && actor.id === log.supervisorId)
            throw new common_1.ForbiddenException("You can't approve your own submission.");
        log.status = 'approved';
        log.approvedById = actor.id || '';
        log.approvedByName = actor.name;
        log.approvedAt = new Date().toISOString();
        return this.logs.save(log);
    }
    async reject(id, note, actor) {
        const log = await this.require(id);
        if (log.status !== 'submitted')
            throw new common_1.BadRequestException(`Cannot reject a log in status "${log.status}"`);
        if (actor.id && actor.id === log.supervisorId)
            throw new common_1.ForbiddenException("You can't reject your own submission.");
        log.status = 'rejected';
        log.approvedById = actor.id || '';
        log.approvedByName = actor.name;
        log.approvedAt = new Date().toISOString();
        log.rejectionNote = note || '';
        return this.logs.save(log);
    }
    async require(id) {
        const log = await this.logs.findOneBy({ id });
        if (!log)
            throw new common_1.NotFoundException(`Daily log ${id} not found`);
        return log;
    }
};
exports.DailyLogsService = DailyLogsService;
exports.DailyLogsService = DailyLogsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.DailyLogEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.LaborLogEntryEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], DailyLogsService);
//# sourceMappingURL=daily-logs.service.js.map