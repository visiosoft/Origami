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
exports.PayrollController = exports.VoidDto = exports.PayDto = exports.UpdatePayslipDto = exports.CreateRunDto = exports.PayComponentDto = exports.PayrollSettingsDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const manpower_access_service_1 = require("./manpower-access.service");
const payroll_service_1 = require("./payroll.service");
const payroll_setup_service_1 = require("./payroll-setup.service");
class PayrollSettingsDto {
}
exports.PayrollSettingsDto = PayrollSettingsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayrollSettingsDto.prototype, "currency", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PayrollSettingsDto.prototype, "standardDayHours", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PayrollSettingsDto.prototype, "halfDayHours", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PayrollSettingsDto.prototype, "monthDays", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], PayrollSettingsDto.prototype, "otMultipliers", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], PayrollSettingsDto.prototype, "weekendDays", void 0);
class PayComponentDto {
}
exports.PayComponentDto = PayComponentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayComponentDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['earning', 'deduction']),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayComponentDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['fixed', 'percent_basic', 'percent_gross']),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayComponentDto.prototype, "calcType", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PayComponentDto.prototype, "defaultValue", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['all', 'monthly', 'daily']),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayComponentDto.prototype, "appliesTo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayComponentDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], PayComponentDto.prototype, "active", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], PayComponentDto.prototype, "order", void 0);
class CreateRunDto {
}
exports.CreateRunDto = CreateRunDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateRunDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRunDto.prototype, "periodStart", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRunDto.prototype, "periodEnd", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['all', 'monthly', 'daily']),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateRunDto.prototype, "payGroup", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateRunDto.prototype, "notes", void 0);
class UpdatePayslipDto {
}
exports.UpdatePayslipDto = UpdatePayslipDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdatePayslipDto.prototype, "work", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], UpdatePayslipDto.prototype, "manualLines", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdatePayslipDto.prototype, "notes", void 0);
class PayDto {
}
exports.PayDto = PayDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Array)
], PayDto.prototype, "payslipIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayDto.prototype, "ref", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], PayDto.prototype, "date", void 0);
class VoidDto {
}
exports.VoidDto = VoidDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], VoidDto.prototype, "reason", void 0);
let PayrollController = class PayrollController {
    constructor(payroll, setup, access) {
        this.payroll = payroll;
        this.setup = setup;
        this.access = access;
    }
    settings() {
        return this.setup.settings();
    }
    async saveSettings(dto, auth) {
        await this.access.require(await this.access.actor(auth), manpower_access_service_1.HR_MODULE, 'change payroll settings');
        return this.setup.saveSettings(dto);
    }
    components() {
        return this.setup.listComponents();
    }
    async createComponent(dto, auth) {
        await this.access.require(await this.access.actor(auth), manpower_access_service_1.HR_MODULE, 'change pay components');
        return this.setup.createComponent(dto);
    }
    async updateComponent(id, dto, auth) {
        await this.access.require(await this.access.actor(auth), manpower_access_service_1.HR_MODULE, 'change pay components');
        return this.setup.updateComponent(id, dto);
    }
    async removeComponent(id, auth) {
        await this.access.require(await this.access.actor(auth), manpower_access_service_1.HR_MODULE, 'change pay components');
        return this.setup.removeComponent(id);
    }
    async reports(q, auth) {
        return this.payroll.report(q, await this.access.actor(auth));
    }
    runs() {
        return this.payroll.listRuns();
    }
    run(id) {
        return this.payroll.getRun(id);
    }
    async createRun(dto, auth) {
        return this.payroll.createRun(dto, await this.access.actor(auth));
    }
    async recalculate(id, auth) {
        return this.payroll.recalculate(id, await this.access.actor(auth));
    }
    async removeRun(id, auth) {
        return this.payroll.removeRun(id, await this.access.actor(auth));
    }
    async finalize(id, auth) {
        return this.payroll.finalize(id, await this.access.actor(auth));
    }
    async voidRun(id, dto, auth) {
        return this.payroll.voidRun(id, dto.reason, await this.access.actor(auth));
    }
    async pay(id, dto, auth) {
        return this.payroll.markPaid(id, dto.payslipIds?.length ? dto.payslipIds : 'all', dto, await this.access.actor(auth));
    }
    async updatePayslip(id, dto, auth) {
        return this.payroll.updatePayslip(id, dto, await this.access.actor(auth));
    }
    employeePayslips(employeeId) {
        return this.payroll.employeePayslips(employeeId);
    }
};
exports.PayrollController = PayrollController;
__decorate([
    (0, common_1.Get)('settings'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PayrollController.prototype, "settings", null);
__decorate([
    (0, common_1.Put)('settings'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PayrollSettingsDto, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "saveSettings", null);
__decorate([
    (0, common_1.Get)('components'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PayrollController.prototype, "components", null);
__decorate([
    (0, common_1.Post)('components'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [PayComponentDto, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "createComponent", null);
__decorate([
    (0, common_1.Put)('components/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PayComponentDto, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "updateComponent", null);
__decorate([
    (0, common_1.Delete)('components/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "removeComponent", null);
__decorate([
    (0, common_1.Get)('reports'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "reports", null);
__decorate([
    (0, common_1.Get)('runs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PayrollController.prototype, "runs", null);
__decorate([
    (0, common_1.Get)('runs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PayrollController.prototype, "run", null);
__decorate([
    (0, common_1.Post)('runs'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateRunDto, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "createRun", null);
__decorate([
    (0, common_1.Post)('runs/:id/recalculate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "recalculate", null);
__decorate([
    (0, common_1.Delete)('runs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "removeRun", null);
__decorate([
    (0, common_1.Post)('runs/:id/finalize'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "finalize", null);
__decorate([
    (0, common_1.Post)('runs/:id/void'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, VoidDto, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "voidRun", null);
__decorate([
    (0, common_1.Post)('runs/:id/pay'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, PayDto, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "pay", null);
__decorate([
    (0, common_1.Put)('payslips/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdatePayslipDto, String]),
    __metadata("design:returntype", Promise)
], PayrollController.prototype, "updatePayslip", null);
__decorate([
    (0, common_1.Get)('employees/:employeeId/payslips'),
    __param(0, (0, common_1.Param)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PayrollController.prototype, "employeePayslips", null);
exports.PayrollController = PayrollController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('payroll'),
    __metadata("design:paramtypes", [payroll_service_1.PayrollService,
        payroll_setup_service_1.PayrollSetupService,
        manpower_access_service_1.ManpowerAccess])
], PayrollController);
//# sourceMappingURL=payroll.controller.js.map