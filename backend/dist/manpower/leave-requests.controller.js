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
exports.LeaveRequestsController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const auth_service_1 = require("../auth/auth.service");
const leave_requests_service_1 = require("./leave-requests.service");
const leave_request_dto_1 = require("./dto/leave-request.dto");
let LeaveRequestsController = class LeaveRequestsController {
    constructor(service, auth) {
        this.service = service;
        this.auth = auth;
    }
    findAll(employeeId, status) {
        return this.service.findAll({ employeeId, status });
    }
    async create(dto, auth) {
        return this.service.create(dto, await this.auth.actor(auth));
    }
    async approve(id, dto, auth) {
        return this.service.decide(id, 'approved', dto.note, await this.auth.actor(auth));
    }
    async deny(id, dto, auth) {
        return this.service.decide(id, 'denied', dto.note, await this.auth.actor(auth));
    }
    remove(id) {
        return this.service.remove(id);
    }
};
exports.LeaveRequestsController = LeaveRequestsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('employeeId')),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [leave_request_dto_1.CreateLeaveRequestDto, String]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, leave_request_dto_1.DecideLeaveRequestDto, String]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/deny'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, leave_request_dto_1.DecideLeaveRequestDto, String]),
    __metadata("design:returntype", Promise)
], LeaveRequestsController.prototype, "deny", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "remove", null);
exports.LeaveRequestsController = LeaveRequestsController = __decorate([
    (0, roles_decorator_1.Tiers)('internal'),
    (0, common_1.Controller)('leave-requests'),
    __metadata("design:paramtypes", [leave_requests_service_1.LeaveRequestsService,
        auth_service_1.AuthService])
], LeaveRequestsController);
//# sourceMappingURL=leave-requests.controller.js.map