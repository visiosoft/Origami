import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FinanceActivityEntity, FinanceSequenceEntity, LeadEntity, PhaseFinancialEntity, ProgressUpdateEntity, ProjectEntity, ProjectFinancialEntity,
  ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, ProjectPhaseEntity, ProjectTaskEntity, RoleEntity, TaskFinancialEntity,
} from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
import { InvoicesService } from './invoices.service';
import { FinanceController, FinanceInvoiceFilesController } from './finance.controller';

/**
 * Project financials: contract values on the existing projects, phases and
 * tasks, earned value, invoices and payments. Reads the project structure; owns
 * only its own tables.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectEntity, LeadEntity, ProjectPhaseEntity, ProjectTaskEntity, RoleEntity,
      ProjectFinancialEntity, PhaseFinancialEntity, TaskFinancialEntity, ProgressUpdateEntity,
      ProjectInvoiceEntity, ProjectInvoiceLineEntity, ProjectPaymentEntity, FinanceSequenceEntity, FinanceActivityEntity,
    ]),
    AuthModule,
    GoogleModule,
    SettingsModule,
  ],
  controllers: [FinanceController, FinanceInvoiceFilesController],
  providers: [ManpowerAccess, FinancialsService, InvoicesService],
})
export class FinanceModule {}
