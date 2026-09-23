import { Controller, Get, Query } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { TimesheetsService } from './timesheets.service';

@Tiers('internal')
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly service: TimesheetsService) {}

  @Get('logged')
  forEmployee(@Query('employeeId') employeeId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.service.forEmployee(employeeId, from, to);
  }
}
