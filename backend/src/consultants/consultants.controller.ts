import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { ConsultantsService } from './consultants.service';
import { ConsultantEntity } from '../database/entities';

@Tiers('internal')
@Controller('consultants')
export class ConsultantsController {
  constructor(private readonly service: ConsultantsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: Partial<ConsultantEntity>) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<ConsultantEntity>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
