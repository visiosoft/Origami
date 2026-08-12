import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { DealEntity } from '../database/entities';
import { DB_ENABLED } from '../database/db.config';

@Module({
  imports: DB_ENABLED ? [TypeOrmModule.forFeature([DealEntity])] : [],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
