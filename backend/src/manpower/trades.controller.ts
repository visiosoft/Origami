import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Tiers } from '../auth/guards/roles.decorator';
import { TradesService } from './trades.service';

export class TradeDto {
  @IsString() @IsOptional() id?: string;
  @IsString() name: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsNumber() @IsOptional() order?: number;
}

@Tiers('internal')
@Controller('trades')
export class TradesController {
  constructor(private readonly service: TradesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: TradeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<TradeDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
