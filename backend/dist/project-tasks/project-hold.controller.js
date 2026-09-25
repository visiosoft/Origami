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
exports.ProjectHoldController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const auth_service_1 = require("../auth/auth.service");
const project_hold_service_1 = require("./project-hold.service");
let ProjectHoldController = class ProjectHoldController {
    constructor(holds, auth) {
        this.holds = holds;
        this.auth = auth;
    }
    async hold(id, body, auth) {
        return this.holds.hold(Number(id), body, await this.auth.actor(auth));
    }
    async resume(id, auth) {
        return this.holds.resume(Number(id), await this.auth.actor(auth));
    }
};
exports.ProjectHoldController = ProjectHoldController;
__decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Post)(':id/hold'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ProjectHoldController.prototype, "hold", null);
__decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Post)(':id/resume'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ProjectHoldController.prototype, "resume", null);
exports.ProjectHoldController = ProjectHoldController = __decorate([
    (0, common_1.Controller)('projects'),
    __metadata("design:paramtypes", [project_hold_service_1.ProjectHoldService,
        auth_service_1.AuthService])
], ProjectHoldController);
//# sourceMappingURL=project-hold.controller.js.map