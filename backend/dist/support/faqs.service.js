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
exports.FaqsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const support_1 = require("../seed-data/support");
let FaqsService = class FaqsService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('FaqsService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(support_1.DEFAULT_FAQS);
                this.log.log(`Seeded ${support_1.DEFAULT_FAQS.length} FAQs`);
            }
        }
        catch (err) {
            this.log.error('FAQ seed failed: ' + err.message);
        }
    }
    findAll() {
        return this.repo.find({ order: { order: 'ASC' } });
    }
    create(dto) {
        const id = dto.id || 'FAQ-' + String(Date.now());
        const faq = { order: 999, category: '', ...dto, id };
        return this.repo.save(this.repo.create(faq));
    }
    async update(id, dto) {
        let faq = await this.repo.findOneBy({ id });
        if (!faq)
            faq = this.repo.create({ id });
        Object.assign(faq, dto, { id });
        return this.repo.save(faq);
    }
    async remove(id) {
        const faq = await this.repo.findOneBy({ id });
        if (faq)
            await this.repo.remove(faq);
        return { id, deleted: true };
    }
};
exports.FaqsService = FaqsService;
exports.FaqsService = FaqsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.FaqEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], FaqsService);
//# sourceMappingURL=faqs.service.js.map