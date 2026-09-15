import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProposalEntity, DealEntity } from '../database/entities';
import { ProposalService } from './proposal.service';
import { ProposalController } from './proposal.controller';
import { SettingsModule } from '../settings/settings.module';
import { GoogleModule } from '../google/google.module';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProposalEntity, DealEntity]), SettingsModule, GoogleModule, PipelineModule],
  controllers: [ProposalController],
  providers: [ProposalService],
  exports: [ProposalService],
})
export class ProposalModule {}
