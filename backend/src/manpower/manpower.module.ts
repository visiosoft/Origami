import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EmployeeEntity, CsiCodeEntity, DailyLogEntity, LaborLogEntryEntity, LeaveRequestEntity, ProjectEntity,
  TradeEntity, EmployeeRecordEntity, EmployeeAssignmentEntity, WorkforceRequestEntity, ContractorEntity,
  PayComponentEntity, PayrollRunEntity, PayslipEntity, OvertimeRequestEntity, EmployeeAdvanceEntity, RoleEntity,
} from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { ManpowerAccess } from './manpower-access.service';
import { PayrollSetupService } from './payroll-setup.service';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { OvertimeService } from './overtime.service';
import { OvertimeController } from './overtime.controller';
import { AdvancesService } from './advances.service';
import { AdvancesController } from './advances.controller';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { CsiCodesController } from './csi-codes.controller';
import { CsiCodesService } from './csi-codes.service';
import { DailyLogsController } from './daily-logs.controller';
import { DailyLogsService } from './daily-logs.service';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { EmployeeRecordsController } from './employee-records.controller';
import { EmployeeRecordsService } from './employee-records.service';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
import { WorkforceRequestsController } from './workforce-requests.controller';
import { WorkforceRequestsService } from './workforce-requests.service';
import { ContractorsController } from './contractors.controller';
import { ContractorsService } from './contractors.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmployeeEntity, CsiCodeEntity, DailyLogEntity, LaborLogEntryEntity, LeaveRequestEntity, ProjectEntity,
      TradeEntity, EmployeeRecordEntity, EmployeeAssignmentEntity, WorkforceRequestEntity, ContractorEntity,
      PayComponentEntity, PayrollRunEntity, PayslipEntity, OvertimeRequestEntity, EmployeeAdvanceEntity, RoleEntity,
    ]),
    AuthModule,
    GoogleModule,
    SettingsModule,
  ],
  controllers: [
    EmployeesController, CsiCodesController, DailyLogsController, TimesheetsController, LeaveRequestsController,
    TradesController, EmployeeRecordsController, AssignmentsController, WorkforceRequestsController, ContractorsController,
    PayrollController, OvertimeController, AdvancesController,
  ],
  providers: [
    EmployeesService, CsiCodesService, DailyLogsService, TimesheetsService, LeaveRequestsService,
    TradesService, EmployeeRecordsService, AssignmentsService, WorkforceRequestsService, ContractorsService,
    ManpowerAccess, PayrollSetupService, PayrollService, OvertimeService, AdvancesService,
  ],
})
export class ManpowerModule {}
