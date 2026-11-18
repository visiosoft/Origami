import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeOrderEntity, ClientApprovalBundleEntity, ProjectEntity, RfiEntity, TaskEntity } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { FileRoomModule } from '../file-room/file-room.module';
import { FinanceModule } from '../finance/finance.module';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { ClientApprovalsController } from './client-approvals.controller';
import { ClientApprovalsService } from './client-approvals.service';

/** Nov 17: client approval bundles (RFIs, decisions, change orders -- approved one by one, signed once). */
@Module({
  imports: [TypeOrmModule.forFeature([ClientApprovalBundleEntity, ProjectEntity, RfiEntity, TaskEntity, ChangeOrderEntity]), AuthModule, FileRoomModule, FinanceModule, GoogleModule, SettingsModule],
  controllers: [ClientApprovalsController],
  providers: [ClientApprovalsService],
})
export class ClientApprovalsModule {}
