import { Body, Controller, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { AssetsService } from './assets.service';

export class AssetDto {
  @IsString() @IsOptional() assetTag?: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() serialNumber?: string;
  @IsString() @IsOptional() condition?: string;
  @IsString() @IsOptional() purchaseDate?: string;
  @IsNumber() @IsOptional() cost?: number;
  @IsString() @IsOptional() notes?: string;
}

export class AssetStatusDto {
  @IsString() status: string;
}

export class IssueDto {
  @IsString() employeeId: string;
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() expectedReturn?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() replacesIssueId?: string;
}

export class ReturnDto {
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() condition?: string;
  @IsBoolean() @IsOptional() toRepair?: boolean;
  @IsNumber() @IsOptional() chargeAmount?: number;
  @IsString() @IsOptional() notes?: string;
}

@Tiers('internal')
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: AssetsService, private readonly access: ManpowerAccess) {}

  @Get() list() { return this.service.list(); }
  @Get('employee/:employeeId') forEmployee(@Param('employeeId') id: string) { return this.service.forEmployee(id); }
  @Get(':id/history') history(@Param('id') id: string) { return this.service.history(id); }
  @Post() async create(@Body() dto: AssetDto, @Headers('authorization') a?: string) { return this.service.create(dto, await this.access.actor(a)); }
  @Put(':id') async update(@Param('id') id: string, @Body() dto: AssetDto, @Headers('authorization') a?: string) { return this.service.update(id, dto, await this.access.actor(a)); }
  @Post(':id/status') async status(@Param('id') id: string, @Body() dto: AssetStatusDto, @Headers('authorization') a?: string) { return this.service.setStatus(id, dto.status, await this.access.actor(a)); }
  @Post(':id/issue') async issue(@Param('id') id: string, @Body() dto: IssueDto, @Headers('authorization') a?: string) { return this.service.issue(id, dto, await this.access.actor(a)); }
  @Post('issues/:id/return') async ret(@Param('id') id: string, @Body() dto: ReturnDto, @Headers('authorization') a?: string) { return this.service.returnIssue(id, dto, await this.access.actor(a)); }
  @Post('issues/:id/lost') async lost(@Param('id') id: string, @Body() dto: ReturnDto, @Headers('authorization') a?: string) { return this.service.reportLost(id, dto, await this.access.actor(a)); }
}
