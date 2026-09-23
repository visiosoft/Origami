import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { ShiftsService } from './shifts.service';

export class ShiftTemplateDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() kind?: string;
  @IsString() @IsOptional() startTime?: string;
  @IsString() @IsOptional() endTime?: string;
  @IsNumber() @IsOptional() allowancePerDay?: number;
  @IsString() @IsOptional() color?: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsNumber() @IsOptional() order?: number;
}

export class ShiftAssignDto {
  @IsArray() employeeIds: string[];
  @IsArray() templateIds: string[];
  @IsNumber() @IsOptional() rotateEveryDays?: number;
  @IsString() startDate: string;
  @IsString() @IsOptional() endDate?: string;
  @IsString() @IsOptional() notes?: string;
}

export class EndDto {
  @IsString() @IsOptional() endDate?: string;
}

@Tiers('internal')
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly service: ShiftsService, private readonly access: ManpowerAccess) {}

  @Get('templates') templates() { return this.service.listTemplates(); }
  @Post('templates') async create(@Body() dto: ShiftTemplateDto, @Headers('authorization') a?: string) { return this.service.createTemplate(dto, await this.access.actor(a)); }
  @Put('templates/:id') async update(@Param('id') id: string, @Body() dto: ShiftTemplateDto, @Headers('authorization') a?: string) { return this.service.updateTemplate(id, dto, await this.access.actor(a)); }
  @Delete('templates/:id') async removeTemplate(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.removeTemplate(id, await this.access.actor(a)); }

  @Get('assignments')
  assignments(@Query('employeeId') employeeId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findAssignments({ employeeId, from, to });
  }
  @Post('assignments') async assign(@Body() dto: ShiftAssignDto, @Headers('authorization') a?: string) { return this.service.assign(dto, await this.access.actor(a)); }
  @Post('assignments/:id/end') async end(@Param('id') id: string, @Body() dto: EndDto, @Headers('authorization') a?: string) { return this.service.end(id, dto.endDate, await this.access.actor(a)); }
  @Delete('assignments/:id') async remove(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.remove(id, await this.access.actor(a)); }
}
