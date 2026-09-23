import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query } from '@nestjs/common';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuthService } from '../auth/auth.service';
import { WorkforceRequestsService } from './workforce-requests.service';

export class WorkforceRequestDto {
  @IsNumber() @IsOptional() projectId?: number;
  @IsString() @IsOptional() workArea?: string;
  @IsString() @IsOptional() requiredDate?: string;
  @IsNumber() @IsOptional() durationDays?: number;
  @IsArray() @IsOptional() lines?: { id?: string; tradeId: string; designation?: string; quantity: number }[];
  @IsString() @IsOptional() notes?: string;
  @IsBoolean() @IsOptional() submit?: boolean;
}

export class DecisionDto {
  @IsString() @IsOptional() note?: string;
}

export class AllocateDto {
  @IsString() lineId: string;
  @IsArray() employeeIds: string[];
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() workArea?: string;
}

@Tiers('internal')
@Controller('workforce-requests')
export class WorkforceRequestsController {
  constructor(
    private readonly service: WorkforceRequestsService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  findAll(@Query('projectId') projectId?: string, @Query('status') status?: string) {
    return this.service.findAll({ projectId: projectId ? Number(projectId) : undefined, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  async create(@Body() dto: WorkforceRequestDto, @Headers('authorization') auth?: string) {
    return this.service.create(dto, await this.auth.actor(auth));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: WorkforceRequestDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.service.submit(id);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() dto: DecisionDto, @Headers('authorization') auth?: string) {
    return this.service.approve(id, dto.note, await this.auth.actor(auth));
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() dto: DecisionDto, @Headers('authorization') auth?: string) {
    return this.service.reject(id, dto.note, await this.auth.actor(auth));
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.service.cancel(id, await this.auth.actor(auth));
  }

  @Post(':id/fulfill')
  async fulfill(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.service.fulfill(id, await this.auth.actor(auth));
  }

  @Post(':id/allocate')
  async allocate(@Param('id') id: string, @Body() dto: AllocateDto, @Headers('authorization') auth?: string) {
    return this.service.allocate(id, dto, await this.auth.actor(auth));
  }
}
