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
exports.CsiCodesService = void 0;
exports.companyRows = companyRows;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const company_cost_codes_1 = require("../seed-data/company-cost-codes");
const settings_service_1 = require("../settings/settings.service");
const LIST_KEY = 'csi.list';
const LIST_VERSION = 'company-v1';
function companyRows() {
    const taken = new Set();
    return company_cost_codes_1.COMPANY_COST_CODES.map((c, i) => ({
        id: (0, company_cost_codes_1.costCodeId)(c.code, c.name, taken), code: c.code, division: c.name, description: c.description || '', active: true, order: i,
    }));
}
let CsiCodesService = class CsiCodesService {
    constructor(repo, settings) {
        this.repo = repo;
        this.settings = settings;
        this.log = new common_1.Logger('CsiCodesService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) === 0) {
                await this.repo.save(companyRows(), { chunk: 40 });
                await this.settings?.set(LIST_KEY, LIST_VERSION);
                this.log.log(`Seeded ${company_cost_codes_1.COMPANY_COST_CODES.length} cost codes`);
            }
            else {
                await this.adoptCompanyList();
            }
        }
        catch (err) {
            this.log.error('Cost code setup failed: ' + err.message);
        }
    }
    async adoptCompanyList() {
        if (!this.settings || (await this.settings.get(LIST_KEY)) === LIST_VERSION)
            return;
        const existing = await this.repo.find();
        const byId = new Map(existing.map((r) => [r.id, r]));
        const rows = companyRows().map((r) => {
            const old = byId.get(r.id);
            return old ? Object.assign(old, { code: r.code, division: r.division, description: old.description || r.description, order: r.order }) : r;
        });
        const custom = existing.filter((r) => !rows.some((x) => x.id === r.id));
        custom.forEach((r, i) => { r.order = rows.length + i; });
        await this.repo.save([...rows, ...custom], { chunk: 40 });
        await this.settings.set(LIST_KEY, LIST_VERSION);
        this.log.log(`Cost codes now follow the company list: ${rows.length} codes, ${custom.length} of your own kept`);
    }
    findAll() {
        return this.repo.find({ order: { order: 'ASC' } });
    }
    async create(dto) {
        const id = dto.id || 'CSI-' + String(Date.now());
        const order = dto.order ?? (await this.repo.count());
        const csiCode = { active: true, description: '', ...dto, order, id };
        return this.repo.save(this.repo.create(csiCode));
    }
    async update(id, dto) {
        const csiCode = await this.repo.findOneBy({ id });
        if (!csiCode)
            throw new common_1.NotFoundException(`CSI code ${id} not found`);
        Object.assign(csiCode, dto, { id });
        return this.repo.save(csiCode);
    }
    async remove(id) {
        const csiCode = await this.repo.findOneBy({ id });
        if (csiCode)
            await this.repo.remove(csiCode);
        return { id, deleted: true };
    }
};
exports.CsiCodesService = CsiCodesService;
exports.CsiCodesService = CsiCodesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.CsiCodeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        settings_service_1.SettingsService])
], CsiCodesService);
//# sourceMappingURL=csi-codes.service.js.map