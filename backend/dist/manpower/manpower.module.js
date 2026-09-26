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
const daily_log_backup_service_1 = require("./daily-log-backup.service");
const people_module_1 = require("../people/people.module");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../database/entities");
const auth_module_1 = require("../auth/auth.module");
const google_module_1 = require("../google/google.module");
const settings_module_1 = require("../settings/settings.module");
const manpower_access_service_1 = require("./manpower-access.service");
const picklists_1 = require("./picklists");
const employees_controller_1 = require("./employees.controller");
const employees_service_1 = require("./employees.service");
const csi_codes_controller_1 = require("./csi-codes.controller");
const csi_codes_service_1 = require("./csi-codes.service");
const daily_logs_controller_1 = require("./daily-logs.controller");
const daily_logs_service_1 = require("./daily-logs.service");
const timesheets_controller_1 = require("./timesheets.controller");
const timesheets_service_1 = require("./timesheets.service");
const subcontractor_trades_controller_1 = require("./subcontractor-trades.controller");
const subcontractor_trades_service_1 = require("./subcontractor-trades.service");
const employee_records_controller_1 = require("./employee-records.controller");
const employee_records_service_1 = require("./employee-records.service");
const assignments_controller_1 = require("./assignments.controller");
const assignments_service_1 = require("./assignments.service");
const workforce_requests_controller_1 = require("./workforce-requests.controller");
const workforce_requests_service_1 = require("./workforce-requests.service");
const contractors_controller_1 = require("./contractors.controller");
const contractors_service_1 = require("./contractors.service");
const payroll_setup_service_1 = require("./payroll-setup.service");
const payroll_service_1 = require("./payroll.service");
const payroll_controller_1 = require("./payroll.controller");
const overtime_service_1 = require("./overtime.service");
const overtime_controller_1 = require("./overtime.controller");
const advances_service_1 = require("./advances.service");
const advances_controller_1 = require("./advances.controller");
const leave_service_1 = require("./leave.service");
const leave_controller_1 = require("./leave.controller");
const shifts_service_1 = require("./shifts.service");
const shifts_controller_1 = require("./shifts.controller");
const assets_service_1 = require("./assets.service");
const assets_controller_1 = require("./assets.controller");
const accommodation_service_1 = require("./accommodation.service");
const accommodation_controller_1 = require("./accommodation.controller");
const transport_service_1 = require("./transport.service");
const transport_controller_1 = require("./transport.controller");
const sample_data_service_1 = require("./sample-data.service");
const weekly_timesheets_service_1 = require("./weekly-timesheets.service");
const weekly_timesheets_controller_1 = require("./weekly-timesheets.controller");
const sample_data_controller_1 = require("./sample-data.controller");
let ManpowerModule = class ManpowerModule {
};
exports.ManpowerModule = ManpowerModule;
exports.ManpowerModule = ManpowerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            people_module_1.PeopleModule,
            typeorm_1.TypeOrmModule.forFeature([
                entities_1.EmployeeEntity, entities_1.CsiCodeEntity, entities_1.DailyLogEntity, entities_1.LaborLogEntryEntity, entities_1.LeaveRequestEntity, entities_1.ProjectEntity,
                entities_1.TradeEntity, entities_1.SubcontractorTradeEntity, entities_1.EmployeeRecordEntity, entities_1.EmployeeAssignmentEntity, entities_1.WorkforceRequestEntity, entities_1.ContractorEntity,
                entities_1.PayComponentEntity, entities_1.PayrollRunEntity, entities_1.PayslipEntity, entities_1.OvertimeRequestEntity, entities_1.EmployeeAdvanceEntity, entities_1.RoleEntity,
                entities_1.LeaveTypeEntity, entities_1.LeaveAdjustmentEntity, entities_1.PublicHolidayEntity, entities_1.ShiftTemplateEntity, entities_1.ShiftAssignmentEntity,
                entities_1.AssetEntity, entities_1.AssetIssueEntity, entities_1.AccommodationUnitEntity, entities_1.BedAllocationEntity, entities_1.AccommodationIssueEntity,
                entities_1.TransportRouteEntity, entities_1.TransportAssignmentEntity, entities_1.TimesheetEntity, entities_1.TimesheetLineEntity, entities_1.UserEntity,
            ]),
            auth_module_1.AuthModule,
            google_module_1.GoogleModule,
            settings_module_1.SettingsModule,
        ],
        controllers: [picklists_1.PicklistsController,
            employees_controller_1.EmployeesController, csi_codes_controller_1.CsiCodesController, daily_logs_controller_1.DailyLogsController, timesheets_controller_1.TimesheetsController,
            subcontractor_trades_controller_1.SubcontractorTradesController, employee_records_controller_1.EmployeeRecordsController, assignments_controller_1.AssignmentsController, workforce_requests_controller_1.WorkforceRequestsController, contractors_controller_1.ContractorsController,
            payroll_controller_1.PayrollController, overtime_controller_1.OvertimeController, advances_controller_1.AdvancesController,
            leave_controller_1.LeaveController, shifts_controller_1.ShiftsController, assets_controller_1.AssetsController, accommodation_controller_1.AccommodationController, transport_controller_1.TransportController, sample_data_controller_1.SampleDataController, weekly_timesheets_controller_1.WeeklyTimesheetsController,
        ],
        providers: [daily_log_backup_service_1.DailyLogBackupService,
            manpower_access_service_1.ManpowerAccess, picklists_1.PicklistsService, employees_service_1.EmployeesService, csi_codes_service_1.CsiCodesService, daily_logs_service_1.DailyLogsService, timesheets_service_1.TimesheetsService,
            subcontractor_trades_service_1.SubcontractorTradesService, employee_records_service_1.EmployeeRecordsService, assignments_service_1.AssignmentsService, workforce_requests_service_1.WorkforceRequestsService, contractors_service_1.ContractorsService,
            payroll_setup_service_1.PayrollSetupService, payroll_service_1.PayrollService, overtime_service_1.OvertimeService, advances_service_1.AdvancesService,
            leave_service_1.LeaveService, shifts_service_1.ShiftsService, assets_service_1.AssetsService, accommodation_service_1.AccommodationService, transport_service_1.TransportService, sample_data_service_1.SampleDataService, weekly_timesheets_service_1.WeeklyTimesheetsService,
        ],
    })
], ManpowerModule);
//# sourceMappingURL=manpower.module.js.map