import { Controller, Get, Query } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { DailyReportSummaryService } from './daily-report-summary.service';

/** Daily Report Section I figures: percentages and counts only, no dollar amounts. */
@Tiers('internal')
@Controller('daily-report')
export class DailyReportSummaryController {
  constructor(private readonly service: DailyReportSummaryService) {}

  @Get('summary')
  summary(@Query('projectId') projectId: string, @Query('date') date?: string) {
    return this.service.summary(Number(projectId), date);
  }
}
