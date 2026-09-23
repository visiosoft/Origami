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
exports.PayrollSetupService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const settings_service_1 = require("../settings/settings.service");
const payroll_calc_1 = require("./payroll.calc");
const workforce_util_1 = require("./workforce.util");
const SETTINGS_KEY = 'payroll.settings';
const DEFAULT_COMPONENTS = [
    { name: 'Site allowance', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', category: 'allowance', active: true },
    { name: 'Travel allowance', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', category: 'allowance', active: true },
    { name: 'Food allowance', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', category: 'allowance', active: true },
    { name: 'Accommodation allowance', kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'monthly', category: 'allowance', active: true },
    { name: 'Income tax', kind: 'deduction', calcType: 'percent_gross', defaultValue: 0, appliesTo: 'monthly', category: 'tax', active: true },
    { name: 'Social security (EOBI)', kind: 'deduction', calcType: 'percent_basic', defaultValue: 0, appliesTo: 'all', category: 'social_security', active: true },
    { name: 'Insurance', kind: 'deduction', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', category: 'insurance', active: true },
];
let PayrollSetupService = class PayrollSetupService {
    constructor(components, store) {
        this.components = components;
        this.store = store;
        this.log = new common_1.Logger('PayrollSetupService');
    }
    async onApplicationBootstrap() {
        try {
            if ((await this.components.count()) === 0) {
                await this.components.save(DEFAULT_COMPONENTS.map((c, i) => ({ ...c, id: 'PC-' + String(i + 1).padStart(2, '0'), order: i })));
                this.log.log(`Seeded ${DEFAULT_COMPONENTS.length} pay components`);
            }
        }
        catch (err) {
            this.log.error('Pay component seed failed: ' + err.message);
        }
    }
    async settings() {
        const raw = await this.store.get(SETTINGS_KEY);
        let saved = {};
        try {
            saved = raw ? JSON.parse(raw) : {};
        }
        catch {
            saved = {};
        }
        return {
            ...payroll_calc_1.DEFAULT_PAYROLL_SETTINGS, ...saved,
            otMultipliers: { ...payroll_calc_1.DEFAULT_PAYROLL_SETTINGS.otMultipliers, ...(saved.otMultipliers || {}) },
        };
    }
    async saveSettings(patch) {
        const next = { ...(await this.settings()), ...patch, otMultipliers: { ...(await this.settings()).otMultipliers, ...(patch.otMultipliers || {}) } };
        const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
        if (!positive(next.standardDayHours) || next.standardDayHours > 24)
            throw new common_1.BadRequestException('A working day must be between 0 and 24 hours.');
        if (!positive(next.halfDayHours) || next.halfDayHours > next.standardDayHours)
            throw new common_1.BadRequestException('A half day must be more than 0 and no longer than a full day.');
        if (!positive(next.monthDays) || next.monthDays > 31)
            throw new common_1.BadRequestException('Days per month must be between 1 and 31.');
        for (const [k, v] of Object.entries(next.otMultipliers))
            if (!positive(v))
                throw new common_1.BadRequestException(`The ${k} overtime multiplier must be above 0.`);
        if (!next.currency?.trim())
            throw new common_1.BadRequestException('Set a currency.');
        if (!Array.isArray(next.weekendDays) || next.weekendDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6))
            throw new common_1.BadRequestException('Weekend days must be weekday numbers 0-6.');
        await this.store.set(SETTINGS_KEY, JSON.stringify(next));
        return next;
    }
    listComponents() {
        return this.components.find({ order: { order: 'ASC' } });
    }
    check(dto) {
        if (dto.kind && !['earning', 'deduction'].includes(dto.kind))
            throw new common_1.BadRequestException('Kind must be earning or deduction.');
        if (dto.calcType && !['fixed', 'percent_basic', 'percent_gross'].includes(dto.calcType))
            throw new common_1.BadRequestException('Unknown calculation type.');
        if (dto.kind === 'earning' && dto.calcType === 'percent_gross')
            throw new common_1.BadRequestException('An earning cannot be a percentage of gross -- gross includes it.');
        if (dto.defaultValue != null && (Number(dto.defaultValue) < 0 || !Number.isFinite(Number(dto.defaultValue))))
            throw new common_1.BadRequestException('The value cannot be negative.');
    }
    async createComponent(dto) {
        if (!dto.name?.trim())
            throw new common_1.BadRequestException('Name the component.');
        const row = { kind: 'earning', calcType: 'fixed', defaultValue: 0, appliesTo: 'all', active: true, order: await this.components.count(), ...dto };
        this.check(row);
        return this.components.save(this.components.create({ ...row, id: (0, workforce_util_1.newId)('PC') }));
    }
    async updateComponent(id, dto) {
        const c = await this.components.findOneBy({ id });
        if (!c)
            throw new common_1.NotFoundException('Pay component not found');
        const next = { ...c, ...dto, id };
        this.check(next);
        return this.components.save(next);
    }
    async removeComponent(id) {
        const c = await this.components.findOneBy({ id });
        if (c)
            await this.components.remove(c);
        return { id, deleted: true };
    }
};
exports.PayrollSetupService = PayrollSetupService;
exports.PayrollSetupService = PayrollSetupService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.PayComponentEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        settings_service_1.SettingsService])
], PayrollSetupService);
//# sourceMappingURL=payroll-setup.service.js.map