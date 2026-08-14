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
let LeadsService = class LeadsService {
    constructor(repo) {
        this.repo = repo;
    }
    getOptions() {
        return leads_1.LEAD_DROPDOWN_OPTIONS;
    }
    findAll() {
        if (!this.repo)
            return [];
        return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    async findOne(id) {
        if (!this.repo)
            throw new common_1.NotFoundException(`Lead ${id} not found`);
        const lead = await this.repo.findOneBy({ id });
        if (!lead)
            throw new common_1.NotFoundException(`Lead ${id} not found`);
        return lead;
    }
    create(dto) {
        const id = dto.id || 'LD-' + String(1000 + Date.now() % 10000);
        const lead = { ...dto, id, createdAt: new Date().toISOString().slice(0, 10) };
        if (!this.repo)
            return lead;
        return this.repo.save(this.repo.create(lead));
    }
    async update(id, dto) {
        if (!this.repo)
            return { id, ...dto };
        let lead = await this.repo.findOneBy({ id });
        if (!lead) {
            lead = this.repo.create({ ...dto, id, createdAt: new Date().toISOString().slice(0, 10) });
        }
        else {
            Object.assign(lead, dto);
        }
        return this.repo.save(lead);
    }
    async remove(id) {
        if (!this.repo)
            return { id, deleted: true };
        const lead = await this.repo.findOneBy({ id });
        if (lead)
            await this.repo.remove(lead);
        return { id, deleted: true };
    }
};
exports.LeadsService = LeadsService;
exports.LeadsService = LeadsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.LeadEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], LeadsService);
//# sourceMappingURL=leads.service.js.map