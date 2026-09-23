import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { LeaveService } from './leave.service';

export class LeaveTypeDto {
  @IsString() @IsOptional() name?: string;
  @IsBoolean() @IsOptional() paid?: boolean;
  @IsBoolean() @IsOptional() trackBalance?: boolean;
  @IsNumber() @IsOptional() annualDays?: number;
  @IsNumber() @IsOptional() carryForwardMax?: number;
  @IsBoolean() @IsOptional() encashable?: boolean;
  @IsString() @IsOptional() color?: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsNumber() @IsOptional() order?: number;
}

export class HolidayDto {
  @IsString() date: string;
  @IsString() name: string;
}

export class LeaveRequestDto {
  @IsString() employeeId: string;
  @IsString() leaveTypeId: string;
  @IsString() startDate: string;
  @IsString() endDate: string;
  @IsBoolean() @IsOptional() halfDay?: boolean;
  @IsString() @IsOptional() reason?: string;
}

export class NoteDto {
  @IsString() @IsOptional() note?: string;
}

export class AdjustDto {
  @IsString() employeeId: string;
  @IsString() leaveTypeId: string;
  @IsNumber() year: number;
  @IsNumber() days: number;
  @IsString() @IsOptional() note?: string;
}

export class CarryForwardDto {
  @IsNumber() fromYear: number;
}

export class YearDto {
  @IsNumber() year: number;
}

@Tiers('internal')
@Controller('leave')
export class LeaveController {
  constructor(
    private readonly service: LeaveService,
    private readonly access: ManpowerAccess,
  ) {}

  private actor(auth?: string) {
    return this.access.actor(auth);
  }

  @Get('types') types() { return this.service.listTypes(); }
  @Post('types') async createType(@Body() dto: LeaveTypeDto, @Headers('authorization') a?: string) { return this.service.createType(dto, await this.actor(a)); }
  @Put('types/:id') async updateType(@Param('id') id: string, @Body() dto: LeaveTypeDto, @Headers('authorization') a?: string) { return this.service.updateType(id, dto, await this.actor(a)); }
  @Delete('types/:id') async removeType(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.removeType(id, await this.actor(a)); }

  @Get('holidays') holidays(@Query('year') year?: string) { return this.service.listHolidays(year ? Number(year) : undefined); }
  @Post('holidays') async addHoliday(@Body() dto: HolidayDto, @Headers('authorization') a?: string) { return this.service.addHoliday(dto, await this.actor(a)); }
  @Post('holidays/us-federal') async usFederal(@Body() dto: YearDto, @Headers('authorization') a?: string) { return this.service.addUsFederalHolidays(dto.year, await this.actor(a)); }
  @Delete('holidays/:id') async removeHoliday(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.removeHoliday(id, await this.actor(a)); }

  @Get('requests')
  requests(@Query('employeeId') employeeId?: string, @Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findRequests({ employeeId, status, from, to });
  }
  @Post('requests/preview') preview(@Body() dto: LeaveRequestDto) { return this.service.preview(dto); }
  @Post('requests') async create(@Body() dto: LeaveRequestDto, @Headers('authorization') a?: string) { return this.service.createRequest(dto, await this.actor(a)); }
  @Post('requests/:id/approve') async approve(@Param('id') id: string, @Body() dto: NoteDto, @Headers('authorization') a?: string) { return this.service.decide(id, 'approved', dto.note, await this.actor(a)); }
  @Post('requests/:id/reject') async reject(@Param('id') id: string, @Body() dto: NoteDto, @Headers('authorization') a?: string) { return this.service.decide(id, 'rejected', dto.note, await this.actor(a)); }
  @Post('requests/:id/cancel') async cancel(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.cancel(id, await this.actor(a)); }

  @Get('balances')
  balances(@Query('employeeId') employeeId: string | undefined, @Query('year') year: string) {
    const y = Number(year) || new Date().getFullYear();
    return employeeId ? this.service.balances(employeeId, y) : this.service.allBalances(y);
  }
  @Get('adjustments') adjustments(@Query('employeeId') employeeId: string) { return this.service.listAdjustments(employeeId); }
  @Post('adjustments') async adjust(@Body() dto: AdjustDto, @Headers('authorization') a?: string) { return this.service.adjust(dto, await this.actor(a)); }
  @Post('encash') async encash(@Body() dto: AdjustDto, @Headers('authorization') a?: string) { return this.service.encash(dto, await this.actor(a)); }
  @Post('carry-forward') async carryForward(@Body() dto: CarryForwardDto, @Headers('authorization') a?: string) { return this.service.carryForward(dto.fromYear, await this.actor(a)); }

  @Get('calendar') calendar(@Query('from') from: string, @Query('to') to: string) { return this.service.calendar(from, to); }
}
