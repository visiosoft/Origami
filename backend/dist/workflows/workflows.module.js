"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const workflows_controller_1 = require("./workflows.controller");
const workflow_items_controller_1 = require("./workflow-items.controller");
const workflows_service_1 = require("./workflows.service");
const workflow_items_service_1 = require("./workflow-items.service");
let WorkflowsModule = class WorkflowsModule {
};
exports.WorkflowsModule = WorkflowsModule;
exports.WorkflowsModule = WorkflowsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([entities_1.WorkflowEntity, entities_1.WorkflowItemEntity])],
        controllers: [workflows_controller_1.WorkflowsController, workflow_items_controller_1.WorkflowItemsController],
        providers: [workflows_service_1.WorkflowsService, workflow_items_service_1.WorkflowItemsService],
    })
], WorkflowsModule);
//# sourceMappingURL=workflows.module.js.map