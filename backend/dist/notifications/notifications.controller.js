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
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const notifications_service_1 = require("./notifications.service");
const roles_decorator_1 = require("../auth/guards/roles.decorator");
const claims_decorator_1 = require("../auth/guards/claims.decorator");
let NotificationsController = class NotificationsController {
    constructor(notifications) {
        this.notifications = notifications;
    }
    async test(claims) {
        if (!claims)
            return { sent: false, reason: 'no session' };
        return this.notifications.sendAssignment({
            surface: 'board',
            taskId: 'SAMPLE-1',
            title: 'Provide Project Program Details',
            description: 'This is a sample assignment email so you can check how it looks. '
                + 'No task was created and nobody else was emailed.',
            projectName: 'Origami DB Development',
            dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
            priority: 'Medium',
            status: 'Not started',
            assigneeId: claims.sub,
            actor: { name: 'Origami', id: undefined },
        });
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Post)('test'),
    __param(0, (0, claims_decorator_1.Claims)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "test", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.Controller)('notifications'),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map