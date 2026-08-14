import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoringCriterionEntity } from '../database/entities';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';
import { DB_ENABLED } from '../database/db.config';

@Module({
  imports: DB_ENABLED ? [TypeOrmModule.forFeature([ScoringCriterionEntity])] : [],
  controllers: [ScoringController],
  providers: [ScoringService],
})
export class ScoringModule {}
