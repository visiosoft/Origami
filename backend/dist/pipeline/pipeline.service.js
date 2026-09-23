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
            const projectFitIdx = pipeline_1.STAGES.findIndex((s) => s.key === 'project_fit');
            const existingLeadIds = new Set((await this.projects.findAll()).map((p) => p.leadId).filter(Boolean));
            const missing = deals.filter((d) => {
                const stage = pipeline_1.STAGES.find((s) => s.key === d.stage);
                return !d.archived && !d.convertedProjectId && !existingLeadIds.has(d.id)
                    && stage && !stage.isHold && !stage.isClosed && stage.idx > projectFitIdx;
            });
            if (missing.length) {
                const missingLeads = await this.leads.findBy({ id: (0, typeorm_2.In)(missing.map((d) => d.id)) });
                const byId = new Map(missingLeads.map((l) => [l.id, l]));
                for (const deal of missing) {
                    try {
                        await this.projects.ensureForLead(this.overlayLead(deal, byId.get(deal.id)));
                    }
                    catch (err) {
                        this.log.warn(`Could not create the Kickoff-stage project for ${deal.id}: ${err.message}`);
                    }
                }
                this.log.log(`Created ${missing.length} Leads-stage project(s) for existing leads`);
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
    overlayLead(deal, lead) {
        return {
            ...deal,
            name: lead?.leadName || '',
            client: (lead?.businessName || '').trim() || lead?.leadName || '',
            phone: lead?.phone || '',
            email: lead?.email || '',
        };
    }
    async findAll(includeArchived = false) {
        const deals = await this.repo.find();
        const visible = includeArchived ? deals : deals.filter((d) => !d.archived);
        const leads = await this.leads.findBy({ id: (0, typeorm_2.In)(visible.map((d) => d.id)) });
        const byId = new Map(leads.map((l) => [l.id, l]));
        return visible.map((d) => this.overlayLead(d, byId.get(d.id)));
    }
    async findOne(id) {
        const deal = await this.repo.findOneBy({ id });
        if (!deal)
            throw new common_1.NotFoundException(`Deal ${id} not found`);
        return this.overlayLead(deal, await this.leads.findOneBy({ id }));
    }
    async create(dto) {
        if (dto?.id && (await this.repo.findOneBy({ id: dto.id }))) {
            throw new common_1.ConflictException(`A deal with id ${dto.id} already exists`);
        }
        const deal = await this.repo.save(this.repo.create(dto));
        return this.overlayLead(deal, await this.leads.findOneBy({ id: deal.id }));
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
        if (deal.status === 'accepted' && stage !== 'client_approval')
            deal.status = 'in_progress';
        if (target?.isHold && target.holdMonths) {
            deal.holdUntil = addMonths(new Date(), target.holdMonths).toISOString().slice(0, 10);
        }
        else {
            deal.holdUntil = '';
        }
        if (stage !== 'rejected' && stage !== 'referred_monitoring' && deal.rejectionType) {
            deal.rejectionType = '';
            deal.rejectionReason = '';
            deal.referredToName = '';
            deal.referredToCompany = '';
            deal.referredToContact = '';
        }
        const detail = deal.holdUntil ? `Moved to ${stageName} — follow up ${deal.holdUntil}` : `Moved to ${stageName}`;
        deal.timeline = [...(deal.timeline || []), this.event(detail, actor)];
        const saved = await this.repo.save(deal);
        const projectFitIdx = pipeline_1.STAGES.findIndex((s) => s.key === 'project_fit');
        if (target && !target.isHold && !target.isClosed && idx > projectFitIdx) {
            try {
                await this.projects.ensureForLead(this.overlayLead(saved, lead));
            }
            catch (err) {
                this.log.warn(`Could not create the Kickoff-stage project for ${id}: ${err.message}`);
            }
        }
        return saved;
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
    async setRejection(id, rejection, actor) {
        const deal = await this.findOne(id);
        deal.rejectionType = rejection.rejectionType;
        deal.rejectionReason = rejection.rejectionReason || '';
        deal.referredToName = rejection.referredToName || '';
        deal.referredToCompany = rejection.referredToCompany || '';
        deal.referredToContact = rejection.referredToContact || '';
        const detail = rejection.rejectionType === 'referred'
            ? `Referred to ${[rejection.referredToName, rejection.referredToCompany].filter(Boolean).join(', ') || 'an external contact'}${rejection.referredToContact ? ` (${rejection.referredToContact})` : ''}`
            : rejection.rejectionType === 'client'
                ? `Rejected — client declined${rejection.rejectionReason ? `: ${rejection.rejectionReason}` : ''}`
                : `Rejected — not a fit for us${rejection.rejectionReason ? `: ${rejection.rejectionReason}` : ''}`;
        deal.timeline = [...(deal.timeline || []), this.event(detail, actor)];
        return this.repo.save(deal);
    }
    async logFollowUp(id, input, actor) {
        const deal = await this.findOne(id);
        const existing = (deal.followUps || []);
        if (input.direction !== 'in' && existing.filter((e) => e.direction !== 'in').length >= exports.MAX_FOLLOW_UPS) {
            throw new common_1.BadRequestException(`All ${exports.MAX_FOLLOW_UPS} attempts have been logged for ${deal.name}.`);
        }
        const inbound = input.direction === 'in';
        const outboundSoFar = existing.filter((e) => e.direction !== 'in').length;
        const attempt = inbound ? 0 : outboundSoFar + 1;
        const isLast = !inbound && attempt >= exports.MAX_FOLLOW_UPS;
        const who = input.contactName?.trim() || (input.target === 'referral' ? 'a referral' : deal.client || deal.name);
        const entry = {
            direction: inbound ? 'in' : 'out',
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
        const detail = inbound
            ? `They got in touch — ${input.method}, ${input.outcome} (${who})`
            : `Attempt ${attempt} of ${exports.MAX_FOLLOW_UPS} — ${input.method}, ${input.outcome} (${who})`;
        deal.timeline = [
            ...(deal.timeline || []),
            this.event(detail, actor, 'pc'),
            ...(isLast && input.assignToName
                ? [this.event(`Handed to ${input.assignToName} after ${exports.MAX_FOLLOW_UPS} attempts`, actor, 'pm')]
                : []),
        ];
        return this.repo.save(deal);
    }
    async setNotes(id, notes, change, actor) {
        const deal = await this.findOne(id);
        deal.stageNotes = notes || [];
        const where = change.stageName ? ` (${change.stageName})` : '';
        const body = change.text ? `: ${change.text}` : '';
        deal.timeline = [
            ...(deal.timeline || []),
            this.event(`${change.action}${where}${body}`, actor, 'pc'),
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
        const fields = {
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
            website: lead?.website || '',
            leadId: id,
            priority: 'Medium',
            progress: 0,
        };
        const placeholder = await this.projects.findByLeadId(id);
        const project = placeholder
            ? await this.projects.update(String(placeholder.id), fields)
            : await this.projects.create(fields);
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