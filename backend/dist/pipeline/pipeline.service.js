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
        this.log = new common_1.Logger('PipelineService');
    }
    async onApplicationBootstrap() {
        try {
            const deals = await this.repo.find();
            const stale = deals.filter((d) => {
                const idx = pipeline_1.STAGES.findIndex((s) => s.key === d.stage);
                return idx >= 0 && d.stageIdx !== idx;
            });
            if (!stale.length)
                return;
            for (const deal of stale)
                deal.stageIdx = pipeline_1.STAGES.findIndex((s) => s.key === deal.stage);
            await this.repo.save(stale);
            this.log.log(`Repaired stageIdx on ${stale.length} deal(s)`);
        }
        catch (err) {
            this.log.warn('Stage index repair failed: ' + err.message);
        }
    }
    getStages() {
        return pipeline_1.STAGES;
    }
    async findAll(includeArchived = false) {
        const deals = await this.repo.find();
        return includeArchived ? deals : deals.filter((d) => !d.archived);
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
    async updateStage(id, stage, actor) {
        const idx = pipeline_1.STAGES.findIndex((s) => s.key === stage);
        const target = idx >= 0 ? pipeline_1.STAGES[idx] : undefined;
        const stageName = target?.name ?? stage;
        const deal = await this.findOne(id);
        deal.stage = stage;
        if (idx >= 0)
            deal.stageIdx = idx;
        if (target?.isHold && target.holdMonths) {
            deal.holdUntil = addMonths(new Date(), target.holdMonths).toISOString().slice(0, 10);
        }
        else {
            deal.holdUntil = '';
        }
        const detail = deal.holdUntil ? `Moved to ${stageName} — follow up ${deal.holdUntil}` : `Moved to ${stageName}`;
        deal.timeline = [...(deal.timeline || []), this.event(detail, actor)];
        return this.repo.save(deal);
    }
    async setArchived(id, archived, actor) {
        const deal = await this.findOne(id);
        deal.archived = archived;
        deal.archivedAt = archived ? new Date().toISOString() : '';
        deal.timeline = [...(deal.timeline || []), this.event(archived ? 'Archived' : 'Restored from archive', actor)];
        return this.repo.save(deal);
    }
    async setRoles(id, roles, actor) {
        const deal = await this.findOne(id);
        const before = deal.roles || {};
        deal.roles = { ...before, ...roles };
        const changed = Object.keys(roles).filter((k) => (before[k] || '') !== (roles[k] || ''));
        if (changed.length) {
            deal.timeline = [
                ...(deal.timeline || []),
                this.event(`Role assignments updated: ${changed.join(', ')}`, actor),
            ];
        }
        return this.repo.save(deal);
    }
    async addEvent(id, action, actor, type = 'auto') {
        const deal = await this.findOne(id);
        deal.timeline = [...(deal.timeline || []), this.event(action, actor, type)];
        return this.repo.save(deal);
    }
    event(action, actor, type = 'auto') {
        const date = new Date().toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
        return { date, action, role: actor?.name || 'System', type, by: actor?.id || '' };
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
function addMonths(from, months) {
    const day = from.getDate();
    const out = new Date(from.getTime());
    out.setDate(1);
    out.setMonth(out.getMonth() + months);
    const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
    out.setDate(Math.min(day, lastDay));
    return out;
}
//# sourceMappingURL=pipeline.service.js.map