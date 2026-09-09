"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectProgramModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const project_program_service_1 = require("./project-program.service");
const project_program_controller_1 = require("./project-program.controller");
const google_module_1 = require("../google/google.module");
const settings_module_1 = require("../settings/settings.module");
let ProjectProgramModule = class ProjectProgramModule {
};
exports.ProjectProgramModule = ProjectProgramModule;
exports.ProjectProgramModule = ProjectProgramModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([entities_1.ProjectProgramEntity, entities_1.ProjectEntity]), google_module_1.GoogleModule, settings_module_1.SettingsModule],
        controllers: [project_program_controller_1.ProjectProgramController],
        providers: [project_program_service_1.ProjectProgramService],
        exports: [project_program_service_1.ProjectProgramService],
    })
], ProjectProgramModule);
//# sourceMappingURL=project-program.module.js.map