import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { AdvancesService } from './advances.service';

export class AdvanceDto {
  @IsString() employeeId: string;
  @IsIn(['salary_advance', 'emergency_advance', 'loan', 'travel_advance', 'project_advance']) type: string;
  @IsNumber() amount: number;
  @IsNumber() @IsOptional() installments?: number;
  @IsString() @IsOptional() reason?: string;
  @IsString() @IsOptional() requestDate?: string;
  @IsString() @IsOptional() deductionStart?: string;
}

export class AdvanceDecisionDto {
  @IsString() @IsOptional() note?: string;
}

export class DisburseDto {
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() method?: string;
  @IsString() @IsOptional() ref?: string;
}

export class RepayDto {
  @IsNumber() amount: number;
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() note?: string;
}

@Tiers('internal')
@Controller('advances')
export class AdvancesController {
  constructor(
    private readonly service: AdvancesService,
    private readonly access: ManpowerAccess,
  ) {}

  @Get()
  findAll(@Query('employeeId') employeeId?: string, @Query('status') status?: string) {
    return this.service.findAll({ employeeId, status });
  }

  @Post()
  async create(@Body() dto: AdvanceDto, @Headers('authorization') auth?: string) {
    return this.service.create(dto, await this.access.actor(auth));
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: AdvanceDecisionDto, @Headers('authorization') auth?: string) {
    return this.service.decide(id, 'approved', dto.note, await this.access.actor(auth));
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: AdvanceDecisionDto, @Headers('authorization') auth?: string) {
    return this.service.decide(id, 'rejected', dto.note, await this.access.actor(auth));
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.service.cancel(id, await this.access.actor(auth));
  }

  @Post(':id/disburse')
  async disburse(@Param('id') id: string, @Body() dto: DisburseDto, @Headers('authorization') auth?: string) {
    return this.service.disburse(id, dto, await this.access.actor(auth));
  }

  @Post(':id/repay')
  async repay(@Param('id') id: string, @Body() dto: RepayDto, @Headers('authorization') auth?: string) {
    return this.service.repay(id, dto, await this.access.actor(auth));
  }
}
