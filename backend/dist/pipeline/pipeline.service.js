"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let PipelineService = class PipelineService {
    constructor() {
        this.stages = [
            { id: 'inquiry', name: 'Inquiry', color: '#7E9B93' },
            { id: 'qualified', name: 'Qualified', color: '#2F6F68' },
            { id: 'scope_review', name: 'Scope Review', color: '#2F6F68' },
            { id: 'estimating', name: 'Estimating', color: '#D2822E' },
            { id: 'proposal', name: 'Proposal', color: '#D2822E' },
            { id: 'negotiation', name: 'Negotiation', color: '#93520F' },
            { id: 'contract', name: 'Contract', color: '#173326' },
            { id: 'won', name: 'Won', color: '#2F7D4A' },
            { id: 'lost', name: 'Lost', color: '#B8410F' },
            { id: 'on_hold', name: 'On Hold', color: '#7E9B93' },
            { id: 'dead', name: 'Dead', color: '#43514D' },
        ];
        this.deals = [
            { id: '1', name: 'Westfield Kitchen Remodel', client: 'Westfield Family', value: 95_000, stage: 'inquiry', owner: 'Sarah Chen', ageDays: 3 },
            { id: '2', name: 'Oak Park Duplex', client: 'Green Investments', value: 1_200_000, stage: 'qualified', owner: 'David Kim', ageDays: 12 },
            { id: '3', name: 'Marina Restaurant TI', client: 'Blue Fin Group', value: 340_000, stage: 'estimating', owner: 'Sarah Chen', ageDays: 8 },
            { id: '4', name: 'Summit View Residence', client: 'Anderson Trust', value: 2_100_000, stage: 'proposal', owner: 'Emily Nguyen', ageDays: 21 },
            { id: '5', name: 'Riverfront Office', client: 'Metro Realty', value: 4_500_000, stage: 'negotiation', owner: 'Sarah Chen', ageDays: 45 },
            { id: '6', name: 'Central Park Townhomes', client: 'Urban Living Co', value: 3_800_000, stage: 'won', owner: 'David Kim', ageDays: 60 },
            { id: '7', name: 'Bayshore Warehouse', client: 'Pacific Logistics', value: 890_000, stage: 'lost', owner: 'Marcus Rivera', ageDays: 30 },
            { id: '8', name: 'Valley Medical Office', client: 'HealthFirst', value: 1_650_000, stage: 'scope_review', owner: 'Emily Nguyen', ageDays: 5 },
            { id: '9', name: 'Heritage Home Addition', client: 'Roberts Family', value: 220_000, stage: 'inquiry', owner: 'David Kim', ageDays: 1 },
        ];
    }
    getStages() {
        return this.stages;
    }
    findAll() {
        return this.deals;
    }
    findOne(id) {
        const deal = this.deals.find((d) => d.id === id);
        if (!deal)
            throw new common_1.NotFoundException(`Deal ${id} not found`);
        return deal;
    }
    create(dto) {
        const deal = {
            id: (0, crypto_1.randomUUID)(),
            stage: dto.stage || 'inquiry',
            ageDays: 0,
            ...dto,
        };
        this.deals.push(deal);
        return deal;
    }
    updateStage(id, stage) {
        const deal = this.deals.find((d) => d.id === id);
        if (!deal)
            throw new common_1.NotFoundException(`Deal ${id} not found`);
        deal.stage = stage;
        return deal;
    }
};
exports.PipelineService = PipelineService;
exports.PipelineService = PipelineService = __decorate([
    (0, common_1.Injectable)()
], PipelineService);
//# sourceMappingURL=pipeline.service.js.map