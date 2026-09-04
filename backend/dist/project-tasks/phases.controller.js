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
exports.PhasesController = void 0;
const common_1 = require("@nestjs/common");
const phases_service_1 = require("./phases.service");
const create_phase_dto_1 = require("./dto/create-phase.dto");
let PhasesController = class PhasesController {
    constructor(service) {
        this.service = service;
    }
    findAll(projectId) {
        return this.service.forProject(Number(projectId));
    }
    getTemplate() {
        return this.service.getTemplate();
    }
    saveTemplate(body) {
        return this.service.saveTemplate(body);
    }
    resetTemplate() {
        return this.service.saveTemplate(null);
    }
    overview() {
        return this.service.overview();
    }
    board(projectId) {
        const pid = Number(projectId);
        if (!Number.isFinite(pid))
            return { phases: [], tasks: [] };
        return this.service.board(pid);
    }
    create(dto) {
        return this.service.create(dto);
    }
    update(id, dto) {
        return this.service.update(id, dto);
    }
    remove(id) {
        return this.service.remove(id);
    }
};
exports.PhasesController = PhasesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PhasesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('template'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PhasesController.prototype, "getTemplate", null);
__decorate([
    (0, common_1.Put)('template'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PhasesController.prototype, "saveTemplate", null);
__decorate([
    (0, common_1.Delete)('template'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PhasesController.prototype, "resetTemplate", null);
__decorate([
    (0, common_1.Get)('overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PhasesController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('board'),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PhasesController.prototype, "board", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_phase_dto_1.CreatePhaseDto]),
    __metadata("design:returntype", void 0)
], PhasesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PhasesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PhasesController.prototype, "remove", null);
exports.PhasesController = PhasesController = __decorate([
    (0, common_1.Controller)('project-phases'),
    __metadata("design:paramtypes", [phases_service_1.PhasesService])
], PhasesController);
//# sourceMappingURL=phases.controller.js.map