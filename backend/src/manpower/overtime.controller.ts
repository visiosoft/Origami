import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsArray, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { OvertimeService } from './overtime.service';

export class OvertimeDto {
  @IsString() employeeId: string;
  @IsNumber() @IsOptional() projectId?: number;
  @IsString() date: string;
  @IsNumber() hours: number;
  @IsIn(['normal', 'weekend', 'holiday', 'night']) @IsOptional() otType?: string;
  @IsNumber() @IsOptional() rate?: number;
  @IsString() @IsOptional() reason?: string;
  @IsIn(['manual', 'daily_log']) @IsOptional() source?: string;
}

export class BulkOvertimeDto {
  @IsArray() items: OvertimeDto[];
}

export class DecisionNoteDto {
  @IsString() @IsOptional() note?: string;
}

@Tiers('internal')
@Controller('overtime')
export class OvertimeController {
  constructor(
    private readonly service: OvertimeService,
    private readonly access: ManpowerAccess,
  ) {}

  @Get()
  findAll(@Query('employeeId') employeeId?: string, @Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findAll({ employeeId, status, from, to });
  }

  @Get('suggestions')
  suggestions(@Query('from') from: string, @Query('to') to: string) {
    return this.service.suggestions(from, to);
  }

  @Post()
  async create(@Body() dto: OvertimeDto, @Headers('authorization') auth?: string) {
    return this.service.create(dto, await this.access.actor(auth));
  }

  @Post('bulk')
  async bulk(@Body() dto: BulkOvertimeDto, @Headers('authorization') auth?: string) {
    return this.service.bulkCreate(dto.items, await this.access.actor(auth));
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: DecisionNoteDto, @Headers('authorization') auth?: string) {
    return this.service.approve(id, dto.note, await this.access.actor(auth));
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: DecisionNoteDto, @Headers('authorization') auth?: string) {
    return this.service.reject(id, dto.note, await this.access.actor(auth));
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.service.cancel(id, await this.access.actor(auth));
  }
}
