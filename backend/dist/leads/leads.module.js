"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const leads_controller_1 = require("./leads.controller");
const leads_service_1 = require("./leads.service");
const entities_1 = require("../database/entities");
const all_files_service_1 = require("./all-files.service");
const client_welcome_service_1 = require("./client-welcome.service");
const client_upload_controller_1 = require("./client-upload.controller");
const tasks_module_1 = require("../tasks/tasks.module");
const google_module_1 = require("../google/google.module");
const auth_module_1 = require("../auth/auth.module");
const lead_files_service_1 = require("./lead-files.service");
const lead_files_controller_1 = require("./lead-files.controller");
let LeadsModule = class LeadsModule {
};
exports.LeadsModule = LeadsModule;
exports.LeadsModule = LeadsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([entities_1.LeadEntity, entities_1.ProjectEntity, entities_1.LeadFilesEntity, entities_1.UserEntity, entities_1.TaskEntity, entities_1.ProjectTaskEntity, entities_1.ProjectPhaseEntity, entities_1.RfiEntity, entities_1.FileRoomFileEntity]), tasks_module_1.TasksModule, google_module_1.GoogleModule, auth_module_1.AuthModule],
        controllers: [leads_controller_1.LeadsController, lead_files_controller_1.LeadFilesController, client_upload_controller_1.ClientUploadController],
        providers: [leads_service_1.LeadsService, lead_files_service_1.LeadFilesService, client_welcome_service_1.ClientWelcomeService, all_files_service_1.AllFilesService],
        exports: [leads_service_1.LeadsService],
    })
], LeadsModule);
//# sourceMappingURL=leads.module.js.map