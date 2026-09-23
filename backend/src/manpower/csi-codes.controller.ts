import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { CsiCodesService } from './csi-codes.service';
import { CreateCsiCodeDto } from './dto/csi-code.dto';

@Tiers('internal')
@Controller('csi-codes')
export class CsiCodesController {
  constructor(private readonly service: CsiCodesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateCsiCodeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCsiCodeDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
