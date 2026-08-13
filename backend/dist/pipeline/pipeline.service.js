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
        this.mem = [...pipeline_1.DEALS];
    }
    getStages() {
        return pipeline_1.STAGES;
    }
    findAll() {
        return this.repo ? this.repo.find() : this.mem;
    }
    async findOne(id) {
        const deal = this.repo ? await this.repo.findOneBy({ id }) : this.mem.find((d) => d.id === id);
        if (!deal)
            throw new common_1.NotFoundException(`Deal ${id} not found`);
        return deal;
    }
    create(dto) {
        if (this.repo)
            return this.repo.save(this.repo.create(dto));
        this.mem = [dto, ...this.mem];
        return dto;
    }
    async updateStage(id, stage) {
        if (this.repo) {
            const deal = await this.findOne(id);
            deal.stage = stage;
            return this.repo.save(deal);
        }
        const deal = this.mem.find((d) => d.id === id);
        if (!deal)
            throw new common_1.NotFoundException(`Deal ${id} not found`);
        deal.stage = stage;
        return deal;
    }
};
exports.PipelineService = PipelineService;
exports.PipelineService = PipelineService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.DealEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PipelineService);
//# sourceMappingURL=pipeline.service.js.map