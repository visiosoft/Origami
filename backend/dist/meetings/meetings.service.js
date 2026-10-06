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
exports.MeetingsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const tasks_service_1 = require("../tasks/tasks.service");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
let MeetingsService = class MeetingsService {
    constructor(repo, tasksRepo, tasks) {
        this.repo = repo;
        this.tasksRepo = tasksRepo;
        this.tasks = tasks;
    }
    list() {
        return this.repo.find({ order: { date: 'DESC', time: 'DESC' } });
    }
    async get(id) {
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
            type: 'Internal', status: 'scheduled', attendees: [], rfiIds: [], ...dto, title: dto.title.trim(),
            id, createdBy: actor.name, createdAt: now, updatedAt: now,
        }));
    }
    async update(id, dto) {
        const m = await this.get(id);
        if (dto.title !== undefined && !dto.title.trim())
            throw new common_1.BadRequestException('The meeting needs a title.');
        if (dto.date !== undefined && !ISO.test(dto.date))
            throw new common_1.BadRequestException('Pick the meeting date.');
        Object.assign(m, dto, { updatedAt: new Date().toISOString() });
        return this.repo.save(m);
    }
    async remove(id) {
        const m = await this.get(id);
        await this.tasksRepo.update({ meetingId: id }, { meetingId: null });
        await this.repo.remove(m);
        return { ok: true };
    }
    async addAction(id, dto, actor) {
        const m = await this.get(id);
        return this.tasks.create({
            topicType: dto.topicType, subject: dto.subject.trim(), description: dto.description || '',
            assignedTo: dto.assignedTo, assignedToId: dto.assignedToId, dueDate: dto.dueDate || undefined,
            project: m.project || '', meetingType: m.type || 'Internal', meetingDate: m.date, meetingId: m.id, tab: 'internal',
        }, actor);
    }
};
exports.MeetingsService = MeetingsService;
exports.MeetingsService = MeetingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.MeetingEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.TaskEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        tasks_service_1.TasksService])
], MeetingsService);
//# sourceMappingURL=meetings.service.js.map