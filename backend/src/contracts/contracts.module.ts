import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeOrderEntity, CommitmentEntity, ContractEntity, ContractTemplateEntity, FileRoomFileEntity, LeadEntity, PersonEntity, ProjectEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { FileRoomModule } from '../file-room/file-room.module';
import { FinanceModule } from '../finance/finance.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractEntity, ContractTemplateEntity, ProjectEntity, LeadEntity, PersonEntity, ChangeOrderEntity, CommitmentEntity, FileRoomFileEntity]),
    GoogleModule, SettingsModule, FileRoomModule, FinanceModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
