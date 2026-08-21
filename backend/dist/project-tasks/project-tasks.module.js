"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectTasksModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const google_module_1 = require("../google/google.module");
const auth_module_1 = require("../auth/auth.module");
const project_tasks_controller_1 = require("./project-tasks.controller");
const sections_controller_1 = require("./sections.controller");
const project_tasks_service_1 = require("./project-tasks.service");
const sections_service_1 = require("./sections.service");
let ProjectTasksModule = class ProjectTasksModule {
};
exports.ProjectTasksModule = ProjectTasksModule;
exports.ProjectTasksModule = ProjectTasksModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([entities_1.ProjectTaskEntity, entities_1.ProjectSectionEntity, entities_1.UserEntity]), google_module_1.GoogleModule, auth_module_1.AuthModule],
        controllers: [project_tasks_controller_1.ProjectTasksController, sections_controller_1.SectionsController],
        providers: [project_tasks_service_1.ProjectTasksService, sections_service_1.SectionsService],
    })
], ProjectTasksModule);
//# sourceMappingURL=project-tasks.module.js.map