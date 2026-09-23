import { Body, Controller, Delete, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ManpowerAccess } from './manpower-access.service';
import { TransportService } from './transport.service';

export class RouteDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() vehicle?: string;
  @IsNumber() @IsOptional() capacity?: number;
  @IsString() @IsOptional() driverEmployeeId?: string;
  @IsNumber() @IsOptional() projectId?: number;
  @IsString() @IsOptional() departureTime?: string;
  @IsString() @IsOptional() returnTime?: string;
  @IsArray() @IsOptional() pickupPoints?: string[];
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
}

export class RiderDto {
  @IsString() employeeId: string;
  @IsString() @IsOptional() pickupPoint?: string;
  @IsString() @IsOptional() startDate?: string;
}

export class RiderEndDto {
  @IsString() @IsOptional() date?: string;
}

@Tiers('internal')
@Controller('transport')
export class TransportController {
  constructor(private readonly service: TransportService, private readonly access: ManpowerAccess) {}

  @Get('routes') list() { return this.service.list(); }
  @Get('employee/:employeeId') history(@Param('employeeId') id: string) { return this.service.history(id); }
  @Post('routes') async create(@Body() dto: RouteDto, @Headers('authorization') a?: string) { return this.service.create(dto, await this.access.actor(a)); }
  @Put('routes/:id') async update(@Param('id') id: string, @Body() dto: RouteDto, @Headers('authorization') a?: string) { return this.service.update(id, dto, await this.access.actor(a)); }
  @Delete('routes/:id') async remove(@Param('id') id: string, @Headers('authorization') a?: string) { return this.service.remove(id, await this.access.actor(a)); }
  @Post('routes/:id/riders') async addRider(@Param('id') id: string, @Body() dto: RiderDto, @Headers('authorization') a?: string) { return this.service.addRider(id, dto, await this.access.actor(a)); }
  @Post('riders/:id/end') async end(@Param('id') id: string, @Body() dto: RiderEndDto, @Headers('authorization') a?: string) { return this.service.endRider(id, dto.date, await this.access.actor(a)); }
}
