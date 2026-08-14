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
exports.ScoringService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const scoring_1 = require("../seed-data/scoring");
let ScoringService = class ScoringService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('ScoringService');
        this.mem = scoring_1.DEFAULT_SCORING.map((c) => ({ ...c }));
    }
    async onApplicationBootstrap() {
        if (!this.repo)
            return;
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(scoring_1.DEFAULT_SCORING);
                this.log.log(`Seeded ${scoring_1.DEFAULT_SCORING.length} scoring criteria`);
            }
        }
        catch (err) {
            this.log.error('Scoring seed failed: ' + err.message);
        }
    }
    async getTemplate() {
        if (!this.repo)
            return this.mem.slice().sort((a, b) => a.order - b.order);
        const rows = await this.repo.find({ order: { order: 'ASC' } });
        return rows.length ? rows : scoring_1.DEFAULT_SCORING;
    }
    async saveTemplate(criteria) {
        const clean = (criteria || []).map((c, i) => ({
            key: c.key || 'c_' + i,
            order: typeof c.order === 'number' ? c.order : i + 1,
            name: c.name || '',
            subCriteria: c.subCriteria || '',
            maxPoints: Number(c.maxPoints) || 0,
            options: (c.options || []).map((o) => ({ label: o.label || '', points: Number(o.points) || 0 })),
        }));
        if (!this.repo) {
            this.mem = clean;
            return this.mem;
        }
        await this.repo.clear();
        await this.repo.save(clean);
        return this.getTemplate();
    }
};
exports.ScoringService = ScoringService;
exports.ScoringService = ScoringService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.ScoringCriterionEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ScoringService);
//# sourceMappingURL=scoring.service.js.map