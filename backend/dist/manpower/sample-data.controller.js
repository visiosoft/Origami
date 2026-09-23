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
exports.SampleDataController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const manpower_access_service_1 = require("./manpower-access.service");
const sample_data_service_1 = require("./sample-data.service");
let SampleDataController = class SampleDataController {
    constructor(service, access) {
        this.service = service;
        this.access = access;
    }
    status() { return this.service.status(); }
    async load(a) { return this.service.load(await this.access.actor(a)); }
    async payroll(a) { return this.service.loadPayroll(await this.access.actor(a)); }
    async remove(a) { return this.service.remove(await this.access.actor(a)); }
};
exports.SampleDataController = SampleDataController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SampleDataController.prototype, "status", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SampleDataController.prototype, "load", null);
__decorate([
    (0, common_1.Post)('payroll'),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SampleDataController.prototype, "payroll", null);
__decorate([
    (0, common_1.Delete)(),
    __param(0, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SampleDataController.prototype, "remove", null);
exports.SampleDataController = SampleDataController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('manpower/sample-data'),
    __metadata("design:paramtypes", [sample_data_service_1.SampleDataService, manpower_access_service_1.ManpowerAccess])
], SampleDataController);
//# sourceMappingURL=sample-data.controller.js.map