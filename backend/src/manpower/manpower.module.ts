import { Module } from '@nestjs/common';
import { DailyLogBackupService } from './daily-log-backup.service';
import { PeopleModule } from '../people/people.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EmployeeEntity, CsiCodeEntity, DailyLogEntity, LaborLogEntryEntity, LeaveRequestEntity, ProjectEntity,
  TradeEntity, SubcontractorTradeEntity, EmployeeRecordEntity, EmployeeAssignmentEntity, WorkforceRequestEntity, ContractorEntity,
  PayComponentEntity, PayrollRunEntity, PayslipEntity, OvertimeRequestEntity, EmployeeAdvanceEntity, RoleEntity,
  LeaveTypeEntity, LeaveAdjustmentEntity, PublicHolidayEntity, ShiftTemplateEntity, ShiftAssignmentEntity,
  AssetEntity, AssetIssueEntity, AccommodationUnitEntity, BedAllocationEntity, AccommodationIssueEntity,
  TransportRouteEntity, TransportAssignmentEntity, TimesheetEntity, TimesheetLineEntity, UserEntity,
} from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { ManpowerAccess } from './manpower-access.service';
import { PicklistsController, PicklistsService } from './picklists';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { CsiCodesController } from './csi-codes.controller';
import { CsiCodesService } from './csi-codes.service';
import { DailyLogsController } from './daily-logs.controller';
import { DailyLogsService } from './daily-logs.service';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { SubcontractorTradesController } from './subcontractor-trades.controller';
import { SubcontractorTradesService } from './subcontractor-trades.service';
import { EmployeeRecordsController } from './employee-records.controller';
import { EmployeeRecordsService } from './employee-records.service';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { WorkforceRequestsController } from './workforce-requests.controller';
import { WorkforceRequestsService } from './workforce-requests.service';
import { ContractorsController } from './contractors.controller';
import { ContractorsService } from './contractors.service';
import { PayrollSetupService } from './payroll-setup.service';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { OvertimeService } from './overtime.service';
import { OvertimeController } from './overtime.controller';
import { AdvancesService } from './advances.service';
import { AdvancesController } from './advances.controller';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { AccommodationService } from './accommodation.service';
import { AccommodationController } from './accommodation.controller';
import { TransportService } from './transport.service';
import { TransportController } from './transport.controller';
import { SampleDataService } from './sample-data.service';
import { WeeklyTimesheetsService } from './weekly-timesheets.service';
import { WeeklyTimesheetsController } from './weekly-timesheets.controller';
import { SampleDataController } from './sample-data.controller';

@Module({
  imports: [
    PeopleModule,
    TypeOrmModule.forFeature([
      EmployeeEntity, CsiCodeEntity, DailyLogEntity, LaborLogEntryEntity, LeaveRequestEntity, ProjectEntity,
      TradeEntity, SubcontractorTradeEntity, EmployeeRecordEntity, EmployeeAssignmentEntity, WorkforceRequestEntity, ContractorEntity,
      PayComponentEntity, PayrollRunEntity, PayslipEntity, OvertimeRequestEntity, EmployeeAdvanceEntity, RoleEntity,
      LeaveTypeEntity, LeaveAdjustmentEntity, PublicHolidayEntity, ShiftTemplateEntity, ShiftAssignmentEntity,
      AssetEntity, AssetIssueEntity, AccommodationUnitEntity, BedAllocationEntity, AccommodationIssueEntity,
      TransportRouteEntity, TransportAssignmentEntity, TimesheetEntity, TimesheetLineEntity, UserEntity,
    ]),
    AuthModule,
    GoogleModule,
    SettingsModule,
  ],
  controllers: [PicklistsController, 
    EmployeesController, CsiCodesController, DailyLogsController, TimesheetsController,
    SubcontractorTradesController, EmployeeRecordsController, AssignmentsController, WorkforceRequestsController, ContractorsController,
    PayrollController, OvertimeController, AdvancesController,
    LeaveController, ShiftsController, AssetsController, AccommodationController, TransportController, SampleDataController, WeeklyTimesheetsController,
  ],
  providers: [DailyLogBackupService, 
    ManpowerAccess, PicklistsService, EmployeesService, CsiCodesService, DailyLogsService, TimesheetsService,
    SubcontractorTradesService, EmployeeRecordsService, AssignmentsService, WorkforceRequestsService, ContractorsService,
    PayrollSetupService, PayrollService, OvertimeService, AdvancesService,
    LeaveService, ShiftsService, AssetsService, AccommodationService, TransportService, SampleDataService, WeeklyTimesheetsService,
  ],
})
export class ManpowerModule {}
