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
exports.LeadsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const leads_1 = require("../seed-data/leads");
const tasks_service_1 = require("../tasks/tasks.service");
const HOMEWORK_TASK_LABEL = 'kind:homework-collection';
const HOMEWORK_EMPTY_TEXT = 'No homework items selected yet.';
let LeadsService = class LeadsService {
    constructor(repo, tasks) {
        this.repo = repo;
        this.tasks = tasks;
        this.log = new common_1.Logger('LeadsService');
    }
    async syncHomeworkTask(leadId, homeworkCompleted) {
        const existing = (await this.tasks.findAll(undefined, leadId))
            .find((t) => (t.labels || []).includes(HOMEWORK_TASK_LABEL));
        if (!homeworkCompleted.length) {
            if (existing && existing.description !== HOMEWORK_EMPTY_TEXT) {
                await this.tasks.update(existing.id, { description: HOMEWORK_EMPTY_TEXT }, { name: 'System' });
            }
            return;
        }
        const description = `Collect from client: ${homeworkCompleted.join(', ')}`;
        if (existing) {
            if (existing.description !== description) {
                await this.tasks.update(existing.id, { description }, { name: 'System' });
            }
        }
        else {
            await this.tasks.create({
                project: leadId, description, labels: [HOMEWORK_TASK_LABEL], topicType: 'Task', tab: 'internal',
            }, { name: 'System' });
        }
    }
    getOptions() {
        return leads_1.LEAD_DROPDOWN_OPTIONS;
    }
    findAll() {
        return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    async findOne(id) {
        const lead = await this.repo.findOneBy({ id });
        if (!lead)
            throw new common_1.NotFoundException(`Lead ${id} not found`);
        return lead;
    }
    async create(dto) {
        const id = dto.id || 'LD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        if (await this.repo.findOneBy({ id })) {
            throw new common_1.ConflictException(`A lead with id ${id} already exists`);
        }
        const lead = { ...dto, id, createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() };
        const saved = await this.repo.save(this.repo.create(lead));
        if ('homeworkCompleted' in dto) {
            this.syncHomeworkTask(id, dto.homeworkCompleted || []).catch((err) => this.log.warn(`Homework task sync failed for ${id}: ${err.message}`));
        }
        return saved;
    }
    async update(id, dto) {
        let lead = await this.repo.findOneBy({ id });
        const now = new Date().toISOString();
        let saved;
        if (!lead) {
            const { expectedUpdatedAt, ...patch } = dto;
            lead = this.repo.create({ ...patch, id, createdAt: new Date().toISOString().slice(0, 10), updatedAt: now });
            saved = await this.repo.save(lead);
        }
        else {
            if (dto.expectedUpdatedAt && lead.updatedAt && dto.expectedUpdatedAt !== lead.updatedAt) {
                throw new common_1.ConflictException('This lead was updated by someone else since you loaded it. Reload and reapply your changes.');
            }
            const { expectedUpdatedAt, ...patch } = dto;
            Object.assign(lead, patch, { updatedAt: now });
            saved = await this.repo.save(lead);
        }
        if ('homeworkCompleted' in dto) {
            this.syncHomeworkTask(id, dto.homeworkCompleted || []).catch((err) => this.log.warn(`Homework task sync failed for ${id}: ${err.message}`));
        }
        return saved;
    }
    async remove(id) {
        const lead = await this.repo.findOneBy({ id });
        if (lead)
            await this.repo.remove(lead);
        return { id, deleted: true };
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        tasks_service_1.TasksService])
], LeadsService);
//# sourceMappingURL=leads.service.js.map