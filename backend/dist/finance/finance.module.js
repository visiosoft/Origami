"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const auth_module_1 = require("../auth/auth.module");
const google_module_1 = require("../google/google.module");
const settings_module_1 = require("../settings/settings.module");
const manpower_access_service_1 = require("../manpower/manpower-access.service");
const financials_service_1 = require("./financials.service");
const invoices_service_1 = require("./invoices.service");
const change_orders_service_1 = require("./change-orders.service");
const reimbursables_service_1 = require("./reimbursables.service");
const retention_service_1 = require("./retention.service");
const finance_hub_service_1 = require("./finance-hub.service");
const costs_service_1 = require("./costs.service");
const reports_service_1 = require("./reports.service");
const finance_controller_1 = require("./finance.controller");
let FinanceModule = class FinanceModule {
};
exports.FinanceModule = FinanceModule;
exports.FinanceModule = FinanceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                entities_1.ProjectEntity, entities_1.LeadEntity, entities_1.ProjectPhaseEntity, entities_1.ProjectTaskEntity, entities_1.ProjectSectionEntity, entities_1.RoleEntity,
                entities_1.ProjectFinancialEntity, entities_1.PhaseFinancialEntity, entities_1.TaskFinancialEntity, entities_1.ProgressUpdateEntity,
                entities_1.ProjectInvoiceEntity, entities_1.ProjectInvoiceLineEntity, entities_1.ProjectPaymentEntity, entities_1.FinanceSequenceEntity, entities_1.FinanceActivityEntity,
                entities_1.ChangeOrderEntity, entities_1.ChangeOrderItemEntity, entities_1.ReimbursableEntity, entities_1.RetentionReleaseEntity, entities_1.FinancialApprovalEntity,
                entities_1.CostBudgetLineEntity, entities_1.CommitmentEntity, entities_1.CommitmentLineEntity, entities_1.CostEntryEntity, entities_1.CostForecastEntity,
                entities_1.TimesheetEntity, entities_1.TimesheetLineEntity, entities_1.DailyLogEntity, entities_1.LaborLogEntryEntity, entities_1.EmployeeEntity, entities_1.CsiCodeEntity, entities_1.ContractorEntity,
            ]),
            auth_module_1.AuthModule,
            google_module_1.GoogleModule,
            settings_module_1.SettingsModule,
        ],
        controllers: [finance_controller_1.FinanceController, finance_controller_1.FinanceInvoiceFilesController, finance_controller_1.FinanceChangeOrderFilesController, finance_controller_1.FinanceReimbursableFilesController, finance_controller_1.FinanceCostFilesController],
        providers: [manpower_access_service_1.ManpowerAccess, financials_service_1.FinancialsService, invoices_service_1.InvoicesService, change_orders_service_1.ChangeOrdersService, reimbursables_service_1.ReimbursablesService, retention_service_1.RetentionService, finance_hub_service_1.FinanceHubService, costs_service_1.CostsService, reports_service_1.ReportsService],
    })
], FinanceModule);
//# sourceMappingURL=finance.module.js.map