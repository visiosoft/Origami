import { Controller, Get, Put, Body } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { ScoringService } from './scoring.service';
import { ScoringCriterion } from '../seed-data/scoring';
import { Perm } from '../auth/guards/perm.guard';

@Tiers('internal')
@Perm('pipeline', 'crm_holding')
@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('template')
  getTemplate() {
    return this.scoringService.getTemplate();
  }

  @Put('template')
  saveTemplate(@Body('criteria') criteria: ScoringCriterion[]) {
    return this.scoringService.saveTemplate(criteria);
  }
}
