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
exports.PipelineService = exports.MAX_FOLLOW_UPS = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const projects_service_1 = require("../projects/projects.service");
const pipeline_1 = require("../seed-data/pipeline");
exports.MAX_FOLLOW_UPS = 3;
let PipelineService = class PipelineService {
    constructor(repo, leads, projects) {
        this.repo = repo;
        this.leads = leads;
        this.projects = projects;
        this.log = new common_1.Logger('PipelineService');
    }
    async onApplicationBootstrap() {
        try {
            const deals = await this.repo.find();
            const stale = deals.filter((d) => {
                const idx = pipeline_1.STAGES.findIndex((s) => s.key === d.stage);
                return idx >= 0 && d.stageIdx !== idx;
            });
            if (stale.length) {
                for (const deal of stale)
                    deal.stageIdx = pipeline_1.STAGES.findIndex((s) => s.key === deal.stage);
                await this.repo.save(stale);
                this.log.log(`Repaired stageIdx on ${stale.length} deal(s)`);
            }
            await this.rehomeRetiredStages(deals);
            const undated = deals.filter((d) => !d.stageEnteredAt);
            if (undated.length) {
                const now = Date.now();
                for (const deal of undated) {
                    const days = Number(deal.daysInStage) || 0;
                    deal.stageEnteredAt = new Date(now - days * 86400000).toISOString();
                }
                await this.repo.save(undated);
                this.log.log(`Backfilled stageEnteredAt on ${undated.length} deal(s)`);
            }
        }
        catch (err) {
            this.log.warn('Stage index repair failed: ' + err.message);
        }
    }
    async rehomeRetiredStages(deals) {
        const stranded = deals.filter((d) => pipeline_1.RETIRED_STAGE_KEYS.includes(d.stage));
        if (!stranded.length)
            return;
        const order = pipeline_1.STAGES.filter((s) => !s.isHold && !s.isClosed);
        for (const deal of stranded) {
            const lead = await this.leads.findOneBy({ id: deal.id });
            const target = order.find((s, i) => i >= 0 && s.idx >= 0 && !pipeline_1.RETIRED_STAGE_KEYS.includes(s.key)
                && s.idx >= deal.stageIdx && !(0, pipeline_1.stageBlockedFor)(lead?.contractType, s.key));
            if (!target)
                continue;
            deal.stage = target.key;
            deal.stageIdx = target.idx;
            deal.timeline = [
                ...(deal.timeline || []),
                this.event(`Stage removed from the funnel — moved to ${target.name}`, { name: 'System' }),
            ];
            await this.repo.save(deal);
            this.log.log(`Moved ${deal.id} off a retired stage to ${target.key}`);
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
        const lead = await this.leads.findOneBy({ id });
        if ((0, pipeline_1.stageBlockedFor)(lead?.contractType, stage)) {
            throw new common_1.BadRequestException(`${stageName} does not apply to a ${(0, pipeline_1.deliveryCode)(lead?.contractType)} lead.`);
        }
        deal.stage = stage;
        if (idx >= 0)
            deal.stageIdx = idx;
        deal.stageEnteredAt = new Date().toISOString();
        deal.daysInStage = 0;
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
    async logFollowUp(id, input, actor) {
        const deal = await this.findOne(id);
        const existing = (deal.followUps || []);
        if (existing.length >= exports.MAX_FOLLOW_UPS) {
            throw new common_1.BadRequestException(`All ${exports.MAX_FOLLOW_UPS} attempts have been logged for ${deal.name}.`);
        }
        const attempt = existing.length + 1;
        const isLast = attempt >= exports.MAX_FOLLOW_UPS;
        const who = input.contactName?.trim() || (input.target === 'referral' ? 'a referral' : deal.client || deal.name);
        const entry = {
            attempt,
            method: input.method,
            outcome: input.outcome,
            note: (input.note || '').trim(),
            target: input.target || 'lead',
            contactName: input.contactName?.trim() || '',
            at: new Date().toISOString(),
            by: actor?.name || 'Unknown',
            byId: actor?.id || '',
            assignedTo: isLast ? (input.assignToName || '') : '',
            assignedToId: isLast ? (input.assignToId || '') : '',
        };
        deal.followUps = [...existing, entry];
        if (isLast && input.assignToName) {
            deal.assignee = input.assignToName;
            deal.assigneeInit = initialsOf(input.assignToName);
            deal.assignedRole = 'PM';
            deal.status = 'awaiting_pm';
        }
        const detail = `Attempt ${attempt} of ${exports.MAX_FOLLOW_UPS} — ${input.method}, ${input.outcome} (${who})`;
        deal.timeline = [
            ...(deal.timeline || []),
            this.event(detail, actor, 'pc'),
            ...(isLast && input.assignToName
                ? [this.event(`Handed to ${input.assignToName} after ${exports.MAX_FOLLOW_UPS} attempts`, actor, 'pm')]
                : []),
        ];
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
    async convertToProject(id, opts, actor) {
        const deal = await this.findOne(id);
        if (deal.convertedProjectId) {
            throw new common_1.BadRequestException(`${deal.name} was already converted to project ${deal.convertedProjectId}.`);
        }
        const lead = await this.leads.findOneBy({ id });
        const location = [lead?.projectCity, lead?.countyLocation].filter(Boolean).join(', ')
            || [lead?.projectStreetAddress, lead?.projectStreetName].filter(Boolean).join(' ');
        const project = await this.projects.create({
            name: opts.name?.trim() || deal.name,
            stage: opts.stage || 'Design',
            contractAmt: opts.contractAmt?.trim() || deal.value || '$0',
            location,
            typeOfWork: lead?.potentialProjectType || '',
            contractType: lead?.contractType || '',
            scope: lead?.projectVision || deal.notes || '',
            estStart: lead?.desiredStart || '',
            referral: lead?.leadSource || deal.source || '',
            contactedBy: deal.assignee || '',
            leadId: id,
            priority: 'Medium',
            progress: 0,
        });
        deal.convertedProjectId = Number(project.id);
        deal.archived = true;
        deal.archivedAt = new Date().toISOString();
        deal.timeline = [
            ...(deal.timeline || []),
            this.event(`Converted to project #${project.id} (${project.stage}) — card archived`, actor),
        ];
        await this.repo.save(deal);
        return { project, deal };
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
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        projects_service_1.ProjectsService])
], PipelineService);
function initialsOf(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length)
        return '?';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
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