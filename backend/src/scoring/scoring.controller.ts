import { Controller, Get, Put, Body } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { ScoringCriterion } from '../seed-data/scoring';

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
