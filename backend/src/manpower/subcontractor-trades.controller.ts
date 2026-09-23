import { Body, Controller, Delete, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { SubcontractorTradesService } from './subcontractor-trades.service';

export class SubcontractorTradeDto {
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsNumber() @IsOptional() order?: number;
}

@Tiers('internal')
@Controller('subcontractor-trades')
export class SubcontractorTradesController {
  constructor(private readonly service: SubcontractorTradesService, private readonly access: ManpowerAccess) {}

  @Get() list() { return this.service.findAll(); }
  @Post() async create(@Body() dto: SubcontractorTradeDto, @Headers('authorization') a?: string) { return this.service.create(dto, await this.access.actor(a)); }
  @Put(':id') async update(@Param('id') id: string, @Body() dto: SubcontractorTradeDto, @Headers('authorization') a?: string) { return this.service.update(id, dto, await this.access.actor(a)); }
  @Delete(':id') async remove(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.remove(id, await this.access.actor(a)); }
}
