import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EmployeeEntity, CsiCodeEntity, DailyLogEntity, LaborLogEntryEntity, LeaveRequestEntity, ProjectEntity,
} from '../database/entities';
import { AuthModule } from '../auth/auth.module';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeEntity, CsiCodeEntity, DailyLogEntity, LaborLogEntryEntity, LeaveRequestEntity, ProjectEntity]),
    AuthModule,
  ],
  controllers: [EmployeesController, CsiCodesController, DailyLogsController, TimesheetsController, LeaveRequestsController],
  providers: [EmployeesService, CsiCodesService, DailyLogsService, TimesheetsService, LeaveRequestsService],
})
export class ManpowerModule {}
