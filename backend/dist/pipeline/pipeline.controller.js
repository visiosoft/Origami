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
exports.PipelineController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const pipeline_service_1 = require("./pipeline.service");
const auth_service_1 = require("../auth/auth.service");
const create_deal_dto_1 = require("./dto/create-deal.dto");
let PipelineController = class PipelineController {
    constructor(pipelineService, auth) {
        this.pipelineService = pipelineService;
        this.auth = auth;
    }
    findAll(archived) {
        return this.pipelineService.findAll(archived === 'true');
    }
    getStages() {
        return this.pipelineService.getStages();
    }
    findOne(id) {
        return this.pipelineService.findOne(id);
    }
    create(dto) {
        return this.pipelineService.create(dto);
    }
    async updateStage(id, stage, auth) {
        return this.pipelineService.updateStage(id, stage, await this.auth.actor(auth));
    }
    async setArchived(id, archived, auth) {
        return this.pipelineService.setArchived(id, !!archived, await this.auth.actor(auth));
    }
    async setRoles(id, roles, auth) {
        return this.pipelineService.setRoles(id, roles, await this.auth.actor(auth));
    }
    async addEvent(id, action, auth) {
        return this.pipelineService.addEvent(id, action, await this.auth.actor(auth));
    }
    async convert(id, body, auth) {
        return this.pipelineService.convertToProject(id, body || {}, await this.auth.actor(auth));
    }
    async logFollowUp(id, body, auth) {
        return this.pipelineService.logFollowUp(id, body, await this.auth.actor(auth));
    }
    async setNotes(id, body, auth) {
        return this.pipelineService.setNotes(id, body?.notes || [], { action: body?.action || 'Note changed', stageName: body?.stageName, text: body?.text }, await this.auth.actor(auth));
    }
    remove(id) {
        return this.pipelineService.remove(id);
    }
};
exports.PipelineController = PipelineController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('archived')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PipelineController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PipelineController.prototype, "getStages", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PipelineController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_deal_dto_1.CreateDealDto]),
    __metadata("design:returntype", void 0)
], PipelineController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id/stage'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('stage')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "updateStage", null);
__decorate([
    (0, common_1.Put)(':id/archived'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('archived')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean, String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "setArchived", null);
__decorate([
    (0, common_1.Put)(':id/roles'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "setRoles", null);
__decorate([
    (0, common_1.Put)(':id/event'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('action')),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "addEvent", null);
__decorate([
    (0, common_1.Post)(':id/convert'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "convert", null);
__decorate([
    (0, common_1.Post)(':id/follow-up'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "logFollowUp", null);
__decorate([
    (0, common_1.Put)(':id/notes'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], PipelineController.prototype, "setNotes", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PipelineController.prototype, "remove", null);
exports.PipelineController = PipelineController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('pipeline'),
    __metadata("design:paramtypes", [pipeline_service_1.PipelineService,
        auth_service_1.AuthService])
], PipelineController);
//# sourceMappingURL=pipeline.controller.js.map