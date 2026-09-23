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
exports.AdvancesService = exports.remainingOf = exports.APPROVAL_CHAIN = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../database/entities");
const manpower_access_service_1 = require("./manpower-access.service");
const payroll_calc_1 = require("./payroll.calc");
const workforce_util_1 = require("./workforce.util");
exports.APPROVAL_CHAIN = [
    { stage: 'manager', status: 'pending_manager', next: 'pending_hr', module: manpower_access_service_1.HR_MODULE, label: 'Manager' },
    { stage: 'hr', status: 'pending_hr', next: 'pending_finance', module: manpower_access_service_1.HR_MODULE, label: 'HR' },
    { stage: 'finance', status: 'pending_finance', next: 'approved', module: manpower_access_service_1.FINANCE_MODULE, label: 'Finance' },
];
const PENDING = exports.APPROVAL_CHAIN.map((s) => s.status);
const remainingOf = (a) => (0, payroll_calc_1.round2)((Number(a.amount) || 0) - (Number(a.recovered) || 0));
exports.remainingOf = remainingOf;
const nextMonthStart = (date) => {
    const d = new Date(date + 'T00:00:00Z');
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
};
let AdvancesService = class AdvancesService {
    constructor(repo, employees, access) {
        this.repo = repo;
        this.employees = employees;
        this.access = access;
    }
    hydrate(a) {
        const remaining = (0, exports.remainingOf)(a);
        const step = exports.APPROVAL_CHAIN.find((s) => s.status === a.status);
        return { ...a, remaining, awaiting: step?.label, nextInstallment: a.status === 'disbursed' ? (0, payroll_calc_1.round2)(Math.min(a.installmentAmount, remaining)) : 0 };
    }
    async findAll(opts) {
        const where = {};
        if (opts.employeeId)
            where.employeeId = opts.employeeId;
        if (opts.status)
            where.status = opts.status;
        const rows = await this.repo.find({ where, order: { requestDate: 'DESC' } });
        return rows.map((a) => this.hydrate(a));
    }
    async load(id) {
        const a = await this.repo.findOneBy({ id });
        if (!a)
            throw new common_1.NotFoundException('Advance / loan not found');
        return a;
    }
    async create(dto, actor) {
        if (!payroll_calc_1.ADVANCE_LABEL[dto.type])
            throw new common_1.BadRequestException('Unknown advance / loan type.');
        const emp = await this.employees.findOneBy({ id: dto.employeeId });
        if (!emp)
            throw new common_1.BadRequestException('Pick the employee.');
        if (emp.contractorId)
            throw new common_1.BadRequestException(`${emp.name} is a contractor's worker -- advances go through their contractor.`);
        const amount = (0, payroll_calc_1.round2)(Number(dto.amount));
        if (!(amount > 0))
            throw new common_1.BadRequestException('The amount must be above 0.');
        const installments = dto.installments == null ? 1 : Number(dto.installments);
        if (!Number.isInteger(installments) || installments < 1 || installments > 120)
            throw new common_1.BadRequestException('Instalments must be a whole number from 1 to 120.');
        const requestDate = dto.requestDate || (0, workforce_util_1.todayISO)();
        const now = new Date().toISOString();
        const a = this.repo.create({
            id: (0, workforce_util_1.newId)('ADV'), employeeId: emp.id, type: dto.type, amount, requestDate, reason: dto.reason,
            installments, installmentAmount: (0, payroll_calc_1.round2)(Math.ceil((amount / installments) * 100) / 100),
            deductionStart: dto.deductionStart || nextMonthStart(requestDate),
            status: 'pending_manager', approvals: [], repayments: [], recovered: 0,
            createdByName: actor.name, createdById: actor.id, createdAt: now, updatedAt: now,
        });
        return this.hydrate(await this.repo.save(a));
    }
    async decide(id, decision, note, actor) {
        const a = await this.load(id);
        const step = exports.APPROVAL_CHAIN.find((s) => s.status === a.status);
        if (!step)
            throw new common_1.BadRequestException(`This request is ${a.status.replace('_', ' ')} -- there is nothing to ${decision === 'approved' ? 'approve' : 'reject'}.`);
        await this.access.require(actor, step.module, `${decision === 'approved' ? 'approve' : 'reject'} at the ${step.label} step`);
        if (actor.id && actor.id === a.createdById)
            throw new common_1.ForbiddenException('You raised this request -- someone else has to decide it.');
        const emp = await this.employees.findOneBy({ id: a.employeeId });
        if (actor.id && emp?.userId && emp.userId === actor.id)
            throw new common_1.ForbiddenException("You can't decide your own advance or loan.");
        if (decision === 'approved' && actor.id && a.approvals.some((x) => x.byId === actor.id)) {
            throw new common_1.ForbiddenException('You already approved an earlier step -- a different person has to approve this one.');
        }
        a.approvals = [...(a.approvals || []), { stage: step.stage, decision, byName: actor.name, byId: actor.id, at: new Date().toISOString(), note: note || undefined }];
        a.status = decision === 'approved' ? step.next : 'rejected';
        a.updatedAt = new Date().toISOString();
        return this.hydrate(await this.repo.save(a));
    }
    async cancel(id, actor) {
        const a = await this.load(id);
        if (![...PENDING, 'approved'].includes(a.status))
            throw new common_1.BadRequestException('Only a request that has not been paid out can be cancelled.');
        const own = !!actor.id && actor.id === a.createdById;
        if (!own && !(await this.access.can(actor, manpower_access_service_1.HR_MODULE)))
            throw new common_1.ForbiddenException('Only the requester or HR can cancel this.');
        a.status = 'cancelled';
        a.updatedAt = new Date().toISOString();
        return this.hydrate(await this.repo.save(a));
    }
    async disburse(id, dto, actor) {
        const a = await this.load(id);
        if (a.status !== 'approved')
            throw new common_1.BadRequestException('Only a fully approved request can be paid out.');
        await this.access.require(actor, manpower_access_service_1.FINANCE_MODULE, 'pay out advances and loans');
        const date = dto.date || (0, workforce_util_1.todayISO)();
        Object.assign(a, {
            status: 'disbursed', disbursedAt: date, disbursedByName: actor.name, paymentMethod: dto.method || 'bank_transfer', paymentRef: dto.ref,
            deductionStart: a.deductionStart < date ? nextMonthStart(date) : a.deductionStart, updatedAt: new Date().toISOString(),
        });
        return this.hydrate(await this.repo.save(a));
    }
    async repay(id, dto, actor) {
        const a = await this.load(id);
        if (a.status !== 'disbursed')
            throw new common_1.BadRequestException('Only an advance that has been paid out and is still owed can take a repayment.');
        await this.access.require(actor, manpower_access_service_1.FINANCE_MODULE, 'record repayments');
        const amount = (0, payroll_calc_1.round2)(Number(dto.amount));
        if (!(amount > 0))
            throw new common_1.BadRequestException('The repayment must be above 0.');
        if (amount > (0, exports.remainingOf)(a) + 0.005)
            throw new common_1.BadRequestException(`Only ${(0, exports.remainingOf)(a)} is still owed.`);
        a.repayments = [...(a.repayments || []), { id: (0, workforce_util_1.newId)('RP'), date: dto.date || (0, workforce_util_1.todayISO)(), amount, method: 'manual', byName: actor.name, note: dto.note }];
        a.recovered = (0, payroll_calc_1.round2)((a.recovered || 0) + amount);
        if ((0, exports.remainingOf)(a) <= 0.005)
            a.status = 'settled';
        a.updatedAt = new Date().toISOString();
        return this.hydrate(await this.repo.save(a));
    }
};
exports.AdvancesService = AdvancesService;
exports.AdvancesService = AdvancesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.EmployeeAdvanceEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.EmployeeEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        manpower_access_service_1.ManpowerAccess])
], AdvancesService);
//# sourceMappingURL=advances.service.js.map