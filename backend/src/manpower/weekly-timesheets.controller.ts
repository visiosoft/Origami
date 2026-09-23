import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { WeeklyTimesheetsService } from './weekly-timesheets.service';

export class TimesheetSaveDto {
  @IsString() employeeId: string;
  @IsString() weekStart: string;
  @IsArray() lines: any[];
  @IsString() @IsOptional() notes?: string;
}

export class TimesheetNoteDto {
  @IsString() @IsOptional() note?: string;
}

@Tiers('internal')
@Controller('timesheets')
export class WeeklyTimesheetsController {
  constructor(private readonly service: WeeklyTimesheetsService, private readonly access: ManpowerAccess) {}

  @Get('me') async me(@Headers('authorization') a?: string) { return { employee: await this.service.me(await this.access.actor(a)) }; }
  @Get('week') async week(@Query('employeeId') employeeId: string, @Query('weekStart') weekStart: string, @Headers('authorization') a?: string) {
    return this.service.week(employeeId, weekStart, await this.access.actor(a));
  }
  @Put('week') async save(@Body() dto: TimesheetSaveDto, @Headers('authorization') a?: string) { return this.service.save(dto, await this.access.actor(a)); }
  @Get('list') async list(@Query('from') from?: string, @Query('to') to?: string, @Query('status') status?: string, @Query('employeeId') employeeId?: string, @Headers('authorization') a?: string) {
    return this.service.list({ from, to, status, employeeId }, await this.access.actor(a));
  }
  @Post(':id/submit') async submit(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.submit(id, await this.access.actor(a)); }
  @Post(':id/approve') async approve(@Param('id') id: string, @Body() dto: TimesheetNoteDto, @Headers('authorization') a?: string) { return this.service.approve(id, dto.note, await this.access.actor(a)); }
  @Post(':id/reject') async reject(@Param('id') id: string, @Body() dto: TimesheetNoteDto, @Headers('authorization') a?: string) { return this.service.reject(id, dto.note, await this.access.actor(a)); }
  @Post(':id/reopen') async reopen(@Param('id') id: string, @Body() dto: TimesheetNoteDto, @Headers('authorization') a?: string) { return this.service.reopen(id, dto.note, await this.access.actor(a)); }
  @Delete(':id') async remove(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.remove(id, await this.access.actor(a)); }
}
