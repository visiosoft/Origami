"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProposalModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const proposal_service_1 = require("./proposal.service");
const proposal_controller_1 = require("./proposal.controller");
const settings_module_1 = require("../settings/settings.module");
const google_module_1 = require("../google/google.module");
const pipeline_module_1 = require("../pipeline/pipeline.module");
let ProposalModule = class ProposalModule {
};
exports.ProposalModule = ProposalModule;
exports.ProposalModule = ProposalModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([entities_1.ProposalEntity, entities_1.DealEntity]), settings_module_1.SettingsModule, google_module_1.GoogleModule, pipeline_module_1.PipelineModule],
        controllers: [proposal_controller_1.ProposalController],
        providers: [proposal_service_1.ProposalService],
        exports: [proposal_service_1.ProposalService],
    })
], ProposalModule);
//# sourceMappingURL=proposal.module.js.map