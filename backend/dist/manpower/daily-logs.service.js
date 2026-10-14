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
    constructor(logs, entries, templates, users) {
        this.logs = logs;
        this.entries = entries;
        this.templates = templates;
        this.users = users;
    }
    async findEntries(opts) {
        const qb = this.logs.createQueryBuilder('log');
        if (opts.projectId != null)
            qb.andWhere('log.projectId = :projectId', { projectId: opts.projectId });
        if (opts.from)
            qb.andWhere('log.date >= :from', { from: opts.from });
        if (opts.to)
            qb.andWhere('log.date <= :to', { to: opts.to });
        const logs = (await qb.getMany()).filter((l) => l.status !== 'superseded');
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
        const logs = await this.logs.find({ where, order: { date: 'DESC' } });
        if (!logs.length)
            return logs;
        const entries = await this.entries.find({ where: { dailyLogId: (0, typeorm_2.In)(logs.map((l) => l.id)) } });
        const sum = new Map();
        for (const e of entries) {
            const v = sum.get(e.dailyLogId) || { crew: 0, hours: 0 };
            v.crew += 1;
            v.hours += Number(e.hours) || 0;
            sum.set(e.dailyLogId, v);
        }
        return logs.map((l) => ({ ...l, crewCount: sum.get(l.id)?.crew || 0, totalHours: Math.round((sum.get(l.id)?.hours || 0) * 100) / 100 }));
    }
    async versionsOf(projectId, date) {
        const rows = await this.logs.find({ where: { projectId, date } });
        return rows.sort((a, b) => (Number(a.version) || 1) - (Number(b.version) || 1));
    }
    newLog(projectId, date, actor, version = 1, versionOf = null) {
        return this.logs.create({
            id: 'DL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
            projectId, date, status: 'draft', version, versionOf: versionOf,
            supervisorId: actor.id, supervisorName: actor.name,
            createdAt: new Date().toISOString(),
        });
    }
    async getForDay(projectId, date, id) {
        const versions = await this.versionsOf(projectId, date);
        const log = (id && versions.find((v) => v.id === id)) || versions[versions.length - 1] || null;
        const entries = log ? await this.entries.find({ where: { dailyLogId: log.id } }) : [];
        return {
            log: log ?? { id: null, projectId, date, status: 'draft', notes: '', version: 1 },
            entries,
            versions: versions.map((v) => ({ id: v.id, version: Number(v.version) || 1, status: v.status, autoReason: v.autoReason || null, supervisorName: v.supervisorName, createdAt: v.createdAt })),
        };
    }
    async save(dto, actor) {
        let log = null;
        if (dto.id) {
            log = await this.logs.findOneBy({ id: dto.id });
            if (!log)
                throw new common_1.NotFoundException('That report no longer exists.');
        }
        else if (!dto.newVersion) {
            const versions = await this.versionsOf(dto.projectId, dto.date);
            log = versions[versions.length - 1] || null;
        }
        if (log && log.status !== 'draft' && log.status !== 'rejected') {
            throw new common_1.BadRequestException('This day has already been submitted -- it can no longer be edited directly.');
        }
        if (!log) {
            const versions = await this.versionsOf(dto.projectId, dto.date);
            log = versions.length
                ? this.newLog(dto.projectId, dto.date, actor, Math.max(...versions.map((v) => Number(v.version) || 1)) + 1, versions[0].id)
                : this.newLog(dto.projectId, dto.date, actor);
        }
        if (log.date !== dto.date || Number(log.projectId) !== Number(dto.projectId)) {
            const there = (await this.versionsOf(dto.projectId, dto.date)).filter((v) => v.id !== log.id);
            if (there.length && !dto.newVersion)
                throw new common_1.ConflictException(`There's already a report for ${dto.date}. Change the date, or add an updated report for that day.`);
            Object.assign(log, {
                projectId: dto.projectId, date: dto.date,
                version: there.length ? Math.max(...there.map((v) => Number(v.version) || 1)) + 1 : 1,
                versionOf: there.length ? there[0].id : null,
            });
        }
        if (log.status === 'rejected')
            log.status = 'draft';
        log.notes = dto.notes ?? log.notes;
        if (dto.sections !== undefined)
            log.sections = dto.sections && typeof dto.sections === 'object' ? dto.sections : null;
        if (dto.onBehalfOf !== undefined)
            log.onBehalfOf = String(dto.onBehalfOf || '').trim() || null;
        if (dto.dupBaseline !== undefined)
            log.dupBaseline = dto.dupBaseline && typeof dto.dupBaseline === 'object' ? dto.dupBaseline : null;
        if (dto.dupFromDate !== undefined)
            log.dupFromDate = dto.dupFromDate || null;
        if (dto.certifiedName !== undefined || dto.signatureDataUrl !== undefined) {
            const name = String(dto.certifiedName ?? log.certifiedName ?? '').trim();
            const sig = String(dto.signatureDataUrl ?? log.signatureDataUrl ?? '');
            log.certifiedName = name || null;
            log.signatureDataUrl = sig || null;
            if (name && sig)
                log.signedAt = log.signedAt || new Date().toISOString();
            else
                log.signedAt = null;
        }
        log = await this.logs.save(log);
        const existing = await this.entries.find({ where: { dailyLogId: log.id } });
        if (existing.length)
            await this.entries.remove(existing);
        const rows = (dto.entries || []).map((e, i) => this.entries.create({
            id: 'LLE-' + String(Date.now()) + '-' + i,
            dailyLogId: log.id, employeeId: e.employeeId, csiCodeId: e.csiCodeId,
            hours: e.hours, taskDetail: e.taskDetail, taskStatus: e.taskStatus, team: e.team,
        }));
        const saved = rows.length ? await this.entries.save(rows, { chunk: 40 }) : [];
        return { log, entries: saved };
    }
    async submit(id, actor) {
        const log = await this.require(id);
        if (log.status !== 'draft' && log.status !== 'rejected')
            throw new common_1.BadRequestException(`Cannot submit a log in status "${log.status}"`);
        if (log.sections) {
            const worked = log.sections?.activity?.worked;
            if (worked !== 'yes' && worked !== 'no')
                throw new common_1.BadRequestException('Answer "Did work occur today?" (Section II) before submitting.');
            if (!log.certifiedName || !log.signatureDataUrl || !log.signedAt)
                throw new common_1.BadRequestException('Sign the certification (Section X) before submitting.');
        }
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
        const saved = await this.logs.save(log);
        const others = (await this.versionsOf(log.projectId, log.date)).filter((v) => v.id !== log.id && v.status === 'approved');
        for (const o of others) {
            o.status = 'superseded';
            await this.logs.save(o);
        }
        return saved;
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
    async listTemplates() {
        const rows = await this.templates.find();
        return rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    async saveTemplate(dto, actor) {
        const name = String(dto.name || '').trim();
        if (!name)
            throw new common_1.BadRequestException('Give the template a name.');
        if (name.length > 120)
            throw new common_1.BadRequestException('Keep the name under 120 characters.');
        const existing = (await this.templates.find()).find((t) => t.name.toLowerCase() === name.toLowerCase());
        if (existing && existing.createdById && existing.createdById !== actor.id && !(await this.isAdmin(actor))) {
            throw new common_1.ConflictException(`There's already a template called "${existing.name}" -- pick another name.`);
        }
        const entries = (Array.isArray(dto.entries) ? dto.entries : []).map((e) => ({ employeeId: e.employeeId, csiCodeId: e.csiCodeId, team: e.team, taskStatus: e.taskStatus, hours: e.hours }));
        const row = this.templates.create({
            ...(existing || { id: 'DRT-' + Date.now().toString(36).toUpperCase(), createdById: actor.id, createdByName: actor.name }),
            name, sections: dto.sections && typeof dto.sections === 'object' ? dto.sections : null, entries,
            createdAt: existing?.createdAt || new Date().toISOString(),
        });
        return this.templates.save(row);
    }
    async removeTemplate(id, actor) {
        const row = await this.templates.findOneBy({ id });
        if (!row)
            return { id, deleted: true };
        if (row.createdById && row.createdById !== actor.id && !(await this.isAdmin(actor))) {
            throw new common_1.ForbiddenException(`Only ${row.createdByName || 'whoever made it'} or an admin can delete this template.`);
        }
        await this.templates.remove(row);
        return { id, deleted: true };
    }
    async ownerEmail(log) {
        if (!log.supervisorId || !this.users)
            return null;
        const u = await this.users.findOneBy({ id: log.supervisorId });
        return u?.email || null;
    }
    async isAdmin(actor) {
        if (!actor.id || !this.users)
            return false;
        const u = await this.users.findOneBy({ id: actor.id });
        return u?.roleKey === 'admin';
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
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.DailyReportTemplateEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DailyLogsService);
//# sourceMappingURL=daily-logs.service.js.map