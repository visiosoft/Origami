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
exports.AssetsService = exports.ASSET_CATEGORIES = void 0;
exports.nextAssetTag = nextAssetTag;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("./manpower-access.service");
const payroll_calc_1 = require("./payroll.calc");
const workforce_util_1 = require("./workforce.util");
exports.ASSET_CATEGORIES = ['laptop', 'mobile', 'sim', 'tools', 'uniform', 'vehicle', 'access_card', 'tablet', 'other'];
const CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function nextAssetTag(tags) {
    const max = tags.reduce((m, t) => { const x = /^AST-(\d+)$/.exec(t || ''); return x ? Math.max(m, Number(x[1])) : m; }, 0);
    return 'AST-' + String(max + 1).padStart(4, '0');
}
let AssetsService = class AssetsService {
    constructor(assets, issues, employees, access) {
        this.assets = assets;
        this.issues = issues;
        this.employees = employees;
        this.access = access;
    }
    async list() {
        const [assets, open] = await Promise.all([this.assets.find({ order: { assetTag: 'ASC' } }), this.issues.find({ where: { status: 'open' } })]);
        const holder = new Map(open.map((i) => [i.assetId, i]));
        return assets.map((a) => ({ ...a, currentIssue: holder.get(a.id) || null }));
    }
    async history(assetId) {
        return (await this.issues.find({ where: { assetId } })).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    }
    async forEmployee(employeeId) {
        const issues = (await this.issues.find({ where: { employeeId } })).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
        const assets = await this.assets.find();
        const byId = new Map(assets.map((a) => [a.id, a]));
        return issues.map((i) => ({ ...i, asset: byId.get(i.assetId) }));
    }
    checkFields(dto) {
        if (dto.category && !exports.ASSET_CATEGORIES.includes(dto.category))
            throw new common_1.BadRequestException('Unknown asset category.');
        if (dto.condition && !CONDITIONS.includes(dto.condition))
            throw new common_1.BadRequestException('Unknown condition.');
        if (dto.cost != null && !(Number(dto.cost) >= 0))
            throw new common_1.BadRequestException('Cost cannot be negative.');
    }
    async create(dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'register assets');
        if (!dto.name?.trim())
            throw new common_1.BadRequestException('Name the asset.');
        this.checkFields(dto);
        if (dto.serialNumber?.trim() && (await this.assets.findOneBy({ serialNumber: dto.serialNumber.trim() }))) {
            throw new common_1.BadRequestException('An asset with that serial number is already registered.');
        }
        const tags = (await this.assets.find({ select: { assetTag: true } })).map((a) => a.assetTag);
        const now = new Date().toISOString();
        return this.assets.save(this.assets.create({
            category: 'other', condition: 'good', ...dto, name: dto.name.trim(), serialNumber: dto.serialNumber?.trim() || undefined,
            status: 'available', assetTag: dto.assetTag?.trim() || nextAssetTag(tags), id: (0, workforce_util_1.newId)('AS'), createdAt: now, updatedAt: now,
        }));
    }
    async update(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'edit assets');
        const a = await this.load(id);
        this.checkFields(dto);
        const { status: _status, ...rest } = dto;
        Object.assign(a, rest, { id, updatedAt: new Date().toISOString() });
        return this.assets.save(a);
    }
    async setStatus(id, status, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'change asset status');
        if (!['available', 'in_repair', 'retired'].includes(status))
            throw new common_1.BadRequestException('Status can be set to available, in repair or retired.');
        const a = await this.load(id);
        if (a.status === 'issued')
            throw new common_1.BadRequestException('This is with someone -- record its return first.');
        Object.assign(a, { status, updatedAt: new Date().toISOString() });
        return this.assets.save(a);
    }
    async load(id) {
        const a = await this.assets.findOneBy({ id });
        if (!a)
            throw new common_1.NotFoundException('Asset not found');
        return a;
    }
    async issue(assetId, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'issue assets');
        const a = await this.load(assetId);
        if (a.status !== 'available')
            throw new common_1.BadRequestException(`${a.name} is ${a.status.replace('_', ' ')} -- it can't be issued.`);
        const emp = await this.employees.findOneBy({ id: dto.employeeId });
        if (!emp)
            throw new common_1.BadRequestException('Pick the employee.');
        if (workforce_util_1.LEFT_STATUSES.includes((0, workforce_util_1.lifecycleStatus)(emp)))
            throw new common_1.BadRequestException(`${emp.name} no longer works here.`);
        const date = dto.date || (0, workforce_util_1.todayISO)();
        if (!ISO.test(date))
            throw new common_1.BadRequestException('Give the issue date.');
        if (dto.expectedReturn && dto.expectedReturn < date)
            throw new common_1.BadRequestException('The return date is before the issue date.');
        return this.assets.manager.transaction(async (m) => {
            const issue = m.getRepository(entities_1.AssetIssueEntity).create({
                id: (0, workforce_util_1.newId)('AI'), assetId, employeeId: emp.id, issuedAt: date, expectedReturn: dto.expectedReturn, status: 'open',
                notes: dto.notes, replacesIssueId: dto.replacesIssueId, issuedByName: actor.name,
            });
            Object.assign(a, { status: 'issued', updatedAt: new Date().toISOString() });
            await m.getRepository(entities_1.AssetEntity).save(a);
            return m.getRepository(entities_1.AssetIssueEntity).save(issue);
        });
    }
    async openIssue(id) {
        const i = await this.issues.findOneBy({ id });
        if (!i)
            throw new common_1.NotFoundException('Issue record not found');
        if (i.status !== 'open')
            throw new common_1.BadRequestException(`This was already ${i.status}.`);
        return i;
    }
    async returnIssue(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'record asset returns');
        const i = await this.openIssue(id);
        const date = dto.date || (0, workforce_util_1.todayISO)();
        if (date < i.issuedAt)
            throw new common_1.BadRequestException('The return is before the item was issued.');
        const condition = dto.condition || 'good';
        if (!CONDITIONS.includes(condition))
            throw new common_1.BadRequestException('Unknown condition.');
        const charge = dto.chargeAmount != null ? (0, payroll_calc_1.round2)(Number(dto.chargeAmount)) : undefined;
        if (charge != null && !(charge >= 0))
            throw new common_1.BadRequestException('A damage charge cannot be negative.');
        return this.assets.manager.transaction(async (m) => {
            Object.assign(i, { status: 'returned', returnedAt: date, returnCondition: condition, chargeAmount: charge, closedByName: actor.name, notes: [i.notes, dto.notes].filter(Boolean).join('\n') || undefined });
            const a = await m.getRepository(entities_1.AssetEntity).findOneBy({ id: i.assetId });
            if (a) {
                Object.assign(a, { status: dto.toRepair ? 'in_repair' : 'available', condition, updatedAt: new Date().toISOString() });
                await m.getRepository(entities_1.AssetEntity).save(a);
            }
            return m.getRepository(entities_1.AssetIssueEntity).save(i);
        });
    }
    async reportLost(id, dto, actor) {
        await this.access.require(actor, manpower_access_service_1.HR_MODULE, 'report lost assets');
        const i = await this.openIssue(id);
        const charge = dto.chargeAmount != null ? (0, payroll_calc_1.round2)(Number(dto.chargeAmount)) : 0;
        if (!(charge >= 0))
            throw new common_1.BadRequestException('The charge cannot be negative.');
        return this.assets.manager.transaction(async (m) => {
            Object.assign(i, { status: 'lost', returnedAt: dto.date || (0, workforce_util_1.todayISO)(), chargeAmount: charge, closedByName: actor.name, notes: [i.notes, dto.notes].filter(Boolean).join('\n') || undefined });
            const a = await m.getRepository(entities_1.AssetEntity).findOneBy({ id: i.assetId });
            if (a) {
                Object.assign(a, { status: 'lost', updatedAt: new Date().toISOString() });
                await m.getRepository(entities_1.AssetEntity).save(a);
            }
            return m.getRepository(entities_1.AssetIssueEntity).save(i);
        });
    }
};
exports.AssetsService = AssetsService;
exports.AssetsService = AssetsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.AssetEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.AssetIssueEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        manpower_access_service_1.ManpowerAccess])
], AssetsService);
//# sourceMappingURL=assets.service.js.map