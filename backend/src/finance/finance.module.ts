import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChangeOrderEntity, ChangeOrderItemEntity, FinanceActivityEntity, FinanceSequenceEntity, FinancialApprovalEntity, LeadEntity, PhaseFinancialEntity,
  ProgressUpdateEntity, ProjectEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, ProjectPhaseEntity,
  ProjectSectionEntity, ProjectTaskEntity, ReimbursableEntity, RetentionReleaseEntity, RoleEntity, TaskFinancialEntity,
  CostBudgetLineEntity, CommitmentEntity, CommitmentLineEntity, CostEntryEntity, CostForecastEntity, TimesheetEntity, TimesheetLineEntity,
  DailyLogEntity, LaborLogEntryEntity, EmployeeEntity, CsiCodeEntity, ContractorEntity,
} from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { InvoicesService } from './invoices.service';
import { ChangeOrdersService } from './change-orders.service';
import { ReimbursablesService } from './reimbursables.service';
import { RetentionService } from './retention.service';
import { FinanceHubService } from './finance-hub.service';
import { CostsService } from './costs.service';
import { ReportsService } from './reports.service';
import {
  FinanceChangeOrderFilesController, FinanceController, FinanceCostFilesController, FinanceInvoiceFilesController, FinanceReimbursableFilesController,
} from './finance.controller';

/**
 * Project financials: contract values on the existing projects, phases and
 * tasks, earned value, invoices and payments, change orders, reimbursables,
 * retention and credit notes. Reads the project structure; owns only its own
 * tables (and adds milestones/tasks when an approved change order asks for them).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEntity, LeadEntity, ProjectPhaseEntity, ProjectTaskEntity, ProjectSectionEntity, RoleEntity,
      ProjectFinancialEntity, PhaseFinancialEntity, TaskFinancialEntity, ProgressUpdateEntity,
      ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, FinanceSequenceEntity, FinanceActivityEntity,
      ChangeOrderEntity, ChangeOrderItemEntity, ReimbursableEntity, RetentionReleaseEntity, FinancialApprovalEntity,
      CostBudgetLineEntity, CommitmentEntity, CommitmentLineEntity, CostEntryEntity, CostForecastEntity,
      TimesheetEntity, TimesheetLineEntity, DailyLogEntity, LaborLogEntryEntity, EmployeeEntity, CsiCodeEntity, ContractorEntity,
    ]),
    AuthModule,
    GoogleModule,
    SettingsModule,
  ],
  controllers: [FinanceController, FinanceInvoiceFilesController, FinanceChangeOrderFilesController, FinanceReimbursableFilesController, FinanceCostFilesController],
  providers: [ManpowerAccess, FinancialsService, InvoicesService, ChangeOrdersService, ReimbursablesService, RetentionService, FinanceHubService, CostsService, ReportsService],
})
export class FinanceModule {}
