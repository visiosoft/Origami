import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { CreateDealDto } from './dto/create-deal.dto';

@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get()
  findAll() {
    return this.pipelineService.findAll();
  }

  @Get('stages')
  getStages() {
    return this.pipelineService.getStages();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pipelineService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateDealDto) {
    return this.pipelineService.create(dto);
  }

  @Put(':id/stage')
  updateStage(@Param('id') id: string, @Body('stage') stage: string) {
    return this.pipelineService.updateStage(id, stage);
  }
}
