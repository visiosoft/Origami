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
exports.WorkflowsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const workflows_1 = require("../seed-data/workflows");
const today = () => new Date().toISOString().slice(0, 10);
let WorkflowsService = class WorkflowsService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('WorkflowsService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(workflows_1.DEFAULT_WORKFLOWS);
                this.log.log(`Seeded ${workflows_1.DEFAULT_WORKFLOWS.length} workflows`);
            }
        }
        catch (err) {
            this.log.error('Workflow seed failed: ' + err.message);
        }
    }
    async findAll(projectId) {
        const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
        if (projectId === undefined)
            return rows;
        if (projectId === 'none' || projectId === 'null')
            return rows.filter((w) => w.projectId == null);
        const pid = Number(projectId);
        return rows.filter((w) => Number(w.projectId) === pid);
    }
    findOne(id) {
        return this.repo.findOneBy({ id });
    }
    create(dto) {
        const id = dto.id || 'W-' + String(Date.now());
        const wf = { status: 'Draft', description: '', createdAt: today(), ...dto, id };
        if (wf.status === 'Done' && !wf.completedAt)
            wf.completedAt = today();
        return this.repo.save(this.repo.create(wf));
    }
    async update(id, dto) {
        let wf = await this.repo.findOneBy({ id });
        if (!wf)
            wf = this.repo.create({ id, createdAt: today() });
        if (typeof dto.status === 'string') {
            if (dto.status === 'Archived' && !dto.completedAt && !wf.completedAt)
                dto = { ...dto, completedAt: today() };
        }
        Object.assign(wf, dto, { id });
        return this.repo.save(wf);
    }
    async remove(id) {
        const wf = await this.repo.findOneBy({ id });
        if (wf)
            await this.repo.remove(wf);
        return { id, deleted: true };
    }
    async applyTemplate(templateId, projectId) {
        const tpl = await this.repo.findOneBy({ id: templateId });
        if (!tpl)
            throw new common_1.NotFoundException(`Template ${templateId} not found`);
        const id = 'W-' + String(Date.now());
        const wf = this.repo.create({
            id, projectId, name: tpl.name, description: tpl.description, status: 'Active',
            owner: tpl.owner, estimatedDays: tpl.estimatedDays, plannedStart: tpl.plannedStart,
            plannedEnd: tpl.plannedEnd, completedAt: undefined, createdAt: today(),
        });
        return this.repo.save(wf);
    }
};
exports.WorkflowsService = WorkflowsService;
exports.WorkflowsService = WorkflowsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.WorkflowEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], WorkflowsService);
//# sourceMappingURL=workflows.service.js.map