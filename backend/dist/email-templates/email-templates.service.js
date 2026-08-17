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
exports.EmailTemplatesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const email_templates_1 = require("../seed-data/email-templates");
let EmailTemplatesService = class EmailTemplatesService {
    constructor(repo) {
        this.repo = repo;
        this.log = new common_1.Logger('EmailTemplatesService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(email_templates_1.DEFAULT_EMAIL_TEMPLATES);
                this.log.log(`Seeded ${email_templates_1.DEFAULT_EMAIL_TEMPLATES.length} email templates`);
            }
        }
        catch (err) {
            this.log.error('Email template seed failed: ' + err.message);
        }
    }
    findAll() {
        return this.repo.find({ order: { name: 'ASC' } });
    }
    findOne(id) {
        return this.repo.findOneBy({ id });
    }
    create(dto) {
        const id = dto.id || 'TPL-' + String(Date.now());
        const tpl = { key: '', subject: '', kind: 'email', category: '', updatedAt: new Date().toISOString(), ...dto, id };
        return this.repo.save(this.repo.create(tpl));
    }
    async update(id, dto) {
        let tpl = await this.repo.findOneBy({ id });
        if (!tpl)
            tpl = this.repo.create({ id });
        Object.assign(tpl, dto, { id, updatedAt: new Date().toISOString() });
        return this.repo.save(tpl);
    }
    async remove(id) {
        const tpl = await this.repo.findOneBy({ id });
        if (tpl)
            await this.repo.remove(tpl);
        return { id, deleted: true };
    }
};
exports.EmailTemplatesService = EmailTemplatesService;
exports.EmailTemplatesService = EmailTemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.EmailTemplateEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], EmailTemplatesService);
//# sourceMappingURL=email-templates.service.js.map