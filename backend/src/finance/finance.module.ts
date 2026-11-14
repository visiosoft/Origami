import { SubInvoicesService } from './sub-invoices.service';
import { LienReleaseEntity, SubInvoiceEntity } from '../database/entities';
import { ChangeOrderPublicController } from './co-public.controller';
import { TrackingModule } from '../tracking/tracking.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChangeOrderEntity, ChangeOrderItemEntity, FinanceActivityEntity, FinanceSequenceEntity, FinancialApprovalEntity, LeadEntity, PhaseFinancialEntity,
  ProgressUpdateEntity, ProjectEntity, ProjectFinancialEntity, ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, ProjectPhaseEntity,
  ProjectSectionEntity, ProjectTaskEntity, ReimbursableEntity, RetentionReleaseEntity, RoleEntity, TaskFinancialEntity,
  CostBudgetLineEntity, CommitmentEntity, CommitmentLineEntity, CostEntryEntity, CostForecastEntity, TimesheetEntity, TimesheetLineEntity,
  DailyLogEntity, LaborLogEntryEntity, EmployeeEntity, CsiCodeEntity, ContractorEntity, UserEntity, PersonEntity, SubcontractorTradeEntity, RfiEntity, ChangeEventEntity, ChangeOrderRequestEntity, CommitmentChangeOrderEntity,
  EstimateEntity, EstimateScopeEntity, EstimateLineEntity, EstimateGrLineEntity, EstimateStatementEntity, BidPackageEntity, BidInviteEntity, ContractorBidEntity,
} from '../database/entities';
import { ProjectSubsService } from './project-subs.service';
import { DailyReportSummaryService } from './daily-report-summary.service';
import { DailyReportSummaryController } from './daily-report-summary.controller';
import { AuthModule } from '../auth/auth.module';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { EstimatesService } from './estimates.service';
import { EstimateLetterService } from './estimate-letter.service';
import { EstimateSetupService } from './estimate-setup.service';
import { BidPackagesService } from './bid-packages.service';
import { BidPublicController } from './bid-public.controller';
import { EstimatePublicController } from './estimate-public.controller';
import { FileRoomModule } from '../file-room/file-room.module';
import { EstimateStatementsService } from './estimate-statements.service';
import { InvoicesService } from './invoices.service';
import { ChangeOrdersService } from './change-orders.service';
import { ChangeEventsService } from './change-events.service';
import { ReimbursablesService } from './reimbursables.service';
import { RetentionService } from './retention.service';
import { FinanceHubService } from './finance-hub.service';
import { CostsService } from './costs.service';
import { ReportsService } from './reports.service';
import { PortalService } from './portal.service';
import { PortalAccessController, PortalController, SharedWithVendorFilesController } from './portal.controller';
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
    TypeOrmModule.forFeature([SubInvoiceEntity, LienReleaseEntity, 
      ProjectEntity, LeadEntity, ProjectPhaseEntity, ProjectTaskEntity, ProjectSectionEntity, RoleEntity,
      ProjectFinancialEntity, PhaseFinancialEntity, TaskFinancialEntity, ProgressUpdateEntity,
      ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, FinanceSequenceEntity, FinanceActivityEntity,
      ChangeOrderEntity, ChangeOrderItemEntity, ChangeEventEntity, ChangeOrderRequestEntity, CommitmentChangeOrderEntity, ReimbursableEntity, RetentionReleaseEntity, FinancialApprovalEntity,
      CostBudgetLineEntity, CommitmentEntity, CommitmentLineEntity, CostEntryEntity, CostForecastEntity,
      TimesheetEntity, TimesheetLineEntity, DailyLogEntity, LaborLogEntryEntity, EmployeeEntity, CsiCodeEntity, ContractorEntity, UserEntity,
      PersonEntity, SubcontractorTradeEntity, RfiEntity,
      EstimateEntity, EstimateScopeEntity, EstimateLineEntity, EstimateGrLineEntity, EstimateStatementEntity, BidPackageEntity, BidInviteEntity, ContractorBidEntity,
    ]),
    AuthModule,
    GoogleModule,
    SettingsModule,
    TrackingModule,
    FileRoomModule,
  ],
  controllers: [ChangeOrderPublicController, EstimatePublicController, BidPublicController, FinanceController, FinanceInvoiceFilesController, FinanceChangeOrderFilesController, FinanceReimbursableFilesController, FinanceCostFilesController,
    PortalController, PortalAccessController, SharedWithVendorFilesController, DailyReportSummaryController],
  providers: [ManpowerAccess, FinancialsService, InvoicesService, ChangeOrdersService, ChangeEventsService, ReimbursablesService, RetentionService, FinanceHubService, CostsService, ReportsService, PortalService, ProjectSubsService, DailyReportSummaryService, EstimatesService, EstimateStatementsService, EstimateLetterService, EstimateSetupService, BidPackagesService, SubInvoicesService],
  exports: [ChangeOrdersService, FinancialsService],
})
export class FinanceModule {}
