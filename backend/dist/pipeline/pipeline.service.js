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
exports.PipelineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const pipeline_1 = require("../seed-data/pipeline");
let PipelineService = class PipelineService {
    constructor(repo) {
        this.repo = repo;
    }
    getStages() {
        return pipeline_1.STAGES;
    }
    findAll() {
        return this.repo.find();
    }
    async findOne(id) {
        const deal = await this.repo.findOneBy({ id });
        if (!deal)
            throw new common_1.NotFoundException(`Deal ${id} not found`);
        return deal;
    }
    create(dto) {
        return this.repo.save(this.repo.create(dto));
    }
    async updateStage(id, stage) {
        const idx = pipeline_1.STAGES.findIndex((s) => s.key === stage);
        const stageName = idx >= 0 ? pipeline_1.STAGES[idx].name : stage;
        const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const entry = { date: when, action: `Moved to ${stageName}`, role: 'System', type: 'auto' };
        const deal = await this.findOne(id);
        deal.stage = stage;
        if (idx >= 0)
            deal.stageIdx = idx;
        deal.timeline = [...(deal.timeline || []), entry];
        return this.repo.save(deal);
    }
    async remove(id) {
        const deal = await this.repo.findOneBy({ id });
        if (deal)
            await this.repo.remove(deal);
        return { id, deleted: true };
    }
};
exports.PipelineService = PipelineService;
exports.PipelineService = PipelineService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.DealEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PipelineService);
//# sourceMappingURL=pipeline.service.js.map