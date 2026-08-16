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
exports.ProjectTasksController = void 0;
const common_1 = require("@nestjs/common");
const project_tasks_service_1 = require("./project-tasks.service");
const create_project_task_dto_1 = require("./dto/create-project-task.dto");
let ProjectTasksController = class ProjectTasksController {
    constructor(service) {
        this.service = service;
    }
    findAll(projectId) {
        return this.service.findAll(projectId ? Number(projectId) : undefined);
    }
    board(projectId) {
        const pid = Number(projectId);
        if (!Number.isFinite(pid))
            return { sections: [], tasks: [] };
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
exports.ProjectTasksController = ProjectTasksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectTasksController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('board'),
    __param(0, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectTasksController.prototype, "board", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_project_task_dto_1.CreateProjectTaskDto]),
    __metadata("design:returntype", void 0)
], ProjectTasksController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProjectTasksController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectTasksController.prototype, "remove", null);
exports.ProjectTasksController = ProjectTasksController = __decorate([
    (0, common_1.Controller)('project-tasks'),
    __metadata("design:paramtypes", [project_tasks_service_1.ProjectTasksService])
], ProjectTasksController);
//# sourceMappingURL=project-tasks.controller.js.map