import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { WorkflowItemsService } from './workflow-items.service';
import { CreateWorkflowItemDto } from './dto/create-workflow-item.dto';

@Tiers('internal')
@Controller('workflow-items')
export class WorkflowItemsController {
  constructor(private readonly service: WorkflowItemsService) {}

  @Get()
  findAll(@Query('workflowId') workflowId?: string) {
    return this.service.findAll(workflowId);
  }

  @Post()
  create(@Body() dto: CreateWorkflowItemDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateWorkflowItemDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
