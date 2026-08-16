import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { WorkflowItemsService } from './workflow-items.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';

@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly service: WorkflowsService,
    private readonly items: WorkflowItemsService,
  ) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateWorkflowDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateWorkflowDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    // Cascade: remove the workflow's items so none orphan.
    await this.items.deleteByWorkflow(id);
    return this.service.remove(id);
  }
}
