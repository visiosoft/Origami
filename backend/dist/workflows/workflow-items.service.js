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
exports.WorkflowItemsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const workflows_1 = require("../seed-data/workflows");
const today = () => new Date().toISOString().slice(0, 10);
let WorkflowItemsService = class WorkflowItemsService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('WorkflowItemsService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(workflows_1.DEFAULT_WORKFLOW_ITEMS);
                this.log.log(`Seeded ${workflows_1.DEFAULT_WORKFLOW_ITEMS.length} workflow items`);
            }
        }
        catch (err) {
            this.log.error('Workflow item seed failed: ' + err.message);
        }
    }
    async findAll(workflowId) {
        const rows = await this.repo.find({ order: { order: 'ASC' } });
        return workflowId ? rows.filter((i) => i.workflowId === workflowId) : rows;
    }
    create(dto) {
        const id = dto.id || 'WI-' + String(Date.now());
        const item = { status: 'Open', order: 0, notes: '', createdAt: today(), ...dto, id };
        if (item.status === 'Done' && !item.completedAt)
            item.completedAt = today();
        return this.repo.save(this.repo.create(item));
    }
    async update(id, dto) {
        let item = await this.repo.findOneBy({ id });
        if (!item)
            item = this.repo.create({ id, createdAt: today() });
        if (typeof dto.status === 'string') {
            if (dto.status === 'Done' && !dto.completedAt && !item.completedAt)
                dto = { ...dto, completedAt: today() };
            if (dto.status !== 'Done')
                dto = { ...dto, completedAt: null };
        }
        Object.assign(item, dto, { id });
        return this.repo.save(item);
    }
    async remove(id) {
        const item = await this.repo.findOneBy({ id });
        if (item)
            await this.repo.remove(item);
        return { id, deleted: true };
    }
    async deleteByWorkflow(workflowId) {
        await this.repo.delete({ workflowId });
    }
    async cloneForWorkflow(fromWorkflowId, toWorkflowId) {
        const src = await this.repo.find({ where: { workflowId: fromWorkflowId }, order: { order: 'ASC' } });
        const clones = src.map((s, i) => ({
            id: 'WI-' + Date.now() + '-' + i,
            workflowId: toWorkflowId,
            title: s.title,
            status: 'Open',
            notes: s.notes,
            order: s.order,
            estimatedDays: s.estimatedDays,
            plannedStart: s.plannedStart,
            plannedEnd: s.plannedEnd,
            completedAt: null,
            createdAt: today(),
        }));
        if (clones.length)
            await this.repo.save(clones);
    }
};
exports.WorkflowItemsService = WorkflowItemsService;
exports.WorkflowItemsService = WorkflowItemsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.WorkflowItemEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], WorkflowItemsService);
//# sourceMappingURL=workflow-items.service.js.map