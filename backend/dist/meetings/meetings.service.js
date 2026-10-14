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
exports.MeetingsService = exports.FOR_RECORD_TOPICS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const tasks_service_1 = require("../tasks/tasks.service");
const meeting_status_1 = require("./meeting-status");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
exports.FOR_RECORD_TOPICS = ['FYI', 'Observation', 'Decision'];
let MeetingsService = class MeetingsService {
    constructor(repo, tasksRepo, tasks, rfis, cos) {
        this.repo = repo;
        this.tasksRepo = tasksRepo;
        this.tasks = tasks;
        this.rfis = rfis;
        this.cos = cos;
        this.log = new common_1.Logger('MeetingsService');
    }
    async onApplicationBootstrap() {
        try {
            const n = await this.migrateStatuses();
            if (n)
                this.log.log(`Moved ${n} meeting(s) onto the new statuses`);
        }
        catch (err) {
            this.log.error('Meeting status migration failed: ' + err.message);
        }
    }
    async migrateStatuses() {
        let n = 0;
        for (const m of await this.repo.find()) {
            const next = (0, meeting_status_1.normalizeMeetingStatus)(m.status);
            if (next === m.status)
                continue;
            m.status = next;
            await this.repo.save(m);
            n++;
        }
        return n;
    }
    async list() {
        const rows = await this.repo.find({ order: { date: 'DESC', time: 'DESC' } });
        return this.settle(rows);
    }
    async get(id) {
        const m = await this.load(id);
        return (await this.settle([m]))[0];
    }
    async load(id) {
        const m = await this.repo.findOneBy({ id });
        if (!m)
            throw new common_1.NotFoundException('Meeting not found');
        return m;
    }
    async create(dto, actor) {
        if (!String(dto.title || '').trim())
            throw new common_1.BadRequestException('Give the meeting a title.');
        if (!ISO.test(dto.date || ''))
            throw new common_1.BadRequestException('Pick the meeting date.');
        const now = new Date().toISOString();
        const id = 'MTG-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        return this.repo.save(this.repo.create({
            type: 'Internal', attendees: [], rfiIds: [], changeOrderIds: [], ...dto, title: dto.title.trim(),
            status: (0, meeting_status_1.normalizeMeetingStatus)(dto.status),
            id, createdBy: actor.name, createdAt: now, updatedAt: now,
        }));
    }
    async update(id, dto, actor) {
        const m = await this.load(id);
        if (dto.title !== undefined && !dto.title.trim())
            throw new common_1.BadRequestException('The meeting needs a title.');
        if (dto.date !== undefined && !ISO.test(dto.date))
            throw new common_1.BadRequestException('Pick the meeting date.');
        const patch = { ...dto };
        if (dto.status !== undefined) {
            patch.status = (0, meeting_status_1.normalizeMeetingStatus)(dto.status);
            const wasReviewed = ['reviewed', 'complete'].includes((0, meeting_status_1.normalizeMeetingStatus)(m.status));
            if (['reviewed', 'complete'].includes(patch.status) && !wasReviewed) {
                patch.reviewedBy = actor?.name || m.reviewedBy;
                patch.reviewedAt = new Date().toISOString();
            }
        }
        for (const k of ['recordingUrl', 'transcriptUrl'])
            if (typeof patch[k] === 'string')
                patch[k] = patch[k].trim();
        Object.assign(m, patch, { updatedAt: new Date().toISOString() });
        const saved = await this.repo.save(m);
        return (await this.settle([saved]))[0];
    }
    async remove(id) {
        const m = await this.load(id);
        await this.tasksRepo.update({ meetingId: id }, { meetingId: null });
        await this.repo.remove(m);
        return { ok: true };
    }
    async addAction(id, dto, actor) {
        const m = await this.load(id);
        const t = await this.tasks.create({
            topicType: dto.topicType, subject: dto.subject.trim(), description: dto.description || '',
            assignedTo: dto.assignedTo, assignedToId: dto.assignedToId, dueDate: dto.dueDate || undefined,
            project: m.project || '', meetingType: m.type || 'Internal', meetingDate: m.date, meetingId: m.id, tab: 'internal',
        }, actor);
        await this.settle([m]);
        return t;
    }
    async settle(rows) {
        if (!rows.length)
            return rows;
        const ids = rows.map((m) => m.id);
        const rfiIds = [...new Set(rows.flatMap((m) => m.rfiIds || []))];
        const coIds = [...new Set(rows.flatMap((m) => m.changeOrderIds || []))];
        const [tasks, rfis, cos, statuses] = await Promise.all([
            this.tasksRepo.find({ where: { meetingId: (0, typeorm_2.In)(ids) }, select: { id: true, meetingId: true, status: true, topicType: true } }),
            this.rfis && rfiIds.length ? this.rfis.find({ where: { id: (0, typeorm_2.In)(rfiIds) }, select: { id: true, status: true } }) : Promise.resolve([]),
            this.cos && coIds.length ? this.cos.find({ where: { id: (0, typeorm_2.In)(coIds) }, select: { id: true, status: true } }) : Promise.resolve([]),
            this.tasks.statuses(),
        ]);
        const closed = statuses.filter((s) => s.closed).map((s) => s.name);
        const rfiStatus = new Map(rfis.map((r) => [r.id, r.status]));
        const coStatus = new Map(cos.map((c) => [c.id, c.status]));
        const changed = [];
        for (const m of rows) {
            const actions = [
                ...tasks.filter((t) => t.meetingId === m.id && !exports.FOR_RECORD_TOPICS.includes(t.topicType)).map((t) => ({ kind: 'task', status: t.status })),
                ...(m.rfiIds || []).filter((r) => rfiStatus.has(r)).map((r) => ({ kind: 'rfi', status: rfiStatus.get(r) })),
                ...(m.changeOrderIds || []).filter((c) => coStatus.has(c)).map((c) => ({ kind: 'changeOrder', status: coStatus.get(c) })),
            ];
            const next = (0, meeting_status_1.settleMeetingStatus)(m.status, actions, closed);
            if (next !== m.status) {
                m.status = next;
                m.updatedAt = new Date().toISOString();
                changed.push(m);
            }
        }
        for (const m of changed)
            await this.repo.save(m);
        return rows;
    }
};
exports.MeetingsService = MeetingsService;
exports.MeetingsService = MeetingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.MeetingEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __param(3, (0, common_1.Optional)()),
    __param(3, (0, typeorm_1.InjectRepository)(entities_1.RfiEntity)),
    __param(4, (0, common_1.Optional)()),
    __param(4, (0, typeorm_1.InjectRepository)(entities_1.ChangeOrderEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        tasks_service_1.TasksService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], MeetingsService);
//# sourceMappingURL=meetings.service.js.map