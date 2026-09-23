import { Body, Controller, Delete, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { AccommodationService } from './accommodation.service';

export class UnitDto {
  @IsString() @IsOptional() parentId?: string;
  @IsString() level: string;
  @IsString() @IsOptional() name?: string;
  @IsNumber() @IsOptional() count?: number;
}

export class UnitUpdateDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() notes?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class AllocateDto {
  @IsString() bedId: string;
  @IsString() employeeId: string;
  @IsString() @IsOptional() checkIn?: string;
  @IsString() @IsOptional() notes?: string;
}

export class CheckoutDto {
  @IsString() @IsOptional() date?: string;
}

export class IssueReportDto {
  @IsString() unitId: string;
  @IsString() title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() employeeId?: string;
}

export class IssueUpdateDto {
  @IsString() status: string;
  @IsString() @IsOptional() resolution?: string;
}

@Tiers('internal')
@Controller('accommodation')
export class AccommodationController {
  constructor(private readonly service: AccommodationService, private readonly access: ManpowerAccess) {}

  @Get() overview() { return this.service.overview(); }
  @Get('employee/:employeeId') history(@Param('employeeId') id: string) { return this.service.history(id); }
  @Post('units') async create(@Body() dto: UnitDto, @Headers('authorization') a?: string) { return this.service.createUnit(dto, await this.access.actor(a)); }
  @Put('units/:id') async update(@Param('id') id: string, @Body() dto: UnitUpdateDto, @Headers('authorization') a?: string) { return this.service.updateUnit(id, dto, await this.access.actor(a)); }
  @Delete('units/:id') async remove(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.removeUnit(id, await this.access.actor(a)); }
  @Post('allocations') async allocate(@Body() dto: AllocateDto, @Headers('authorization') a?: string) { return this.service.allocate(dto, await this.access.actor(a)); }
  @Post('allocations/:id/checkout') async checkout(@Param('id') id: string, @Body() dto: CheckoutDto, @Headers('authorization') a?: string) { return this.service.checkout(id, dto.date, await this.access.actor(a)); }
  @Post('issues') async report(@Body() dto: IssueReportDto, @Headers('authorization') a?: string) { return this.service.reportIssue(dto, await this.access.actor(a)); }
  @Put('issues/:id') async updateIssue(@Param('id') id: string, @Body() dto: IssueUpdateDto, @Headers('authorization') a?: string) { return this.service.updateIssue(id, dto, await this.access.actor(a)); }
}
