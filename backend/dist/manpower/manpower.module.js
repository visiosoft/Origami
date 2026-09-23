"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManpowerModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const auth_module_1 = require("../auth/auth.module");
const google_module_1 = require("../google/google.module");
const employees_controller_1 = require("./employees.controller");
const employees_service_1 = require("./employees.service");
const csi_codes_controller_1 = require("./csi-codes.controller");
const csi_codes_service_1 = require("./csi-codes.service");
const daily_logs_controller_1 = require("./daily-logs.controller");
const daily_logs_service_1 = require("./daily-logs.service");
const timesheets_controller_1 = require("./timesheets.controller");
const timesheets_service_1 = require("./timesheets.service");
const leave_requests_controller_1 = require("./leave-requests.controller");
const leave_requests_service_1 = require("./leave-requests.service");
const trades_controller_1 = require("./trades.controller");
const trades_service_1 = require("./trades.service");
const employee_records_controller_1 = require("./employee-records.controller");
const employee_records_service_1 = require("./employee-records.service");
let ManpowerModule = class ManpowerModule {
};
exports.ManpowerModule = ManpowerModule;
exports.ManpowerModule = ManpowerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                entities_1.EmployeeEntity, entities_1.CsiCodeEntity, entities_1.DailyLogEntity, entities_1.LaborLogEntryEntity, entities_1.LeaveRequestEntity, entities_1.ProjectEntity,
                entities_1.TradeEntity, entities_1.EmployeeRecordEntity,
            ]),
            auth_module_1.AuthModule,
            google_module_1.GoogleModule,
        ],
        controllers: [
            employees_controller_1.EmployeesController, csi_codes_controller_1.CsiCodesController, daily_logs_controller_1.DailyLogsController, timesheets_controller_1.TimesheetsController, leave_requests_controller_1.LeaveRequestsController,
            trades_controller_1.TradesController, employee_records_controller_1.EmployeeRecordsController,
        ],
        providers: [
            employees_service_1.EmployeesService, csi_codes_service_1.CsiCodesService, daily_logs_service_1.DailyLogsService, timesheets_service_1.TimesheetsService, leave_requests_service_1.LeaveRequestsService,
            trades_service_1.TradesService, employee_records_service_1.EmployeeRecordsService,
        ],
    })
], ManpowerModule);
//# sourceMappingURL=manpower.module.js.map