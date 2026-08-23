import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { WorkflowsService } from './workflows.service';
import { WorkflowItemsService } from './workflow-items.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';

@Tiers('internal')
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly service: WorkflowsService,
    private readonly items: WorkflowItemsService,
  ) {}

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.service.findAll(projectId);
  }

  // Clone a template workflow (+ its items) into a project.
  @Post('apply')
  async apply(@Body() body: { templateId: string; projectId: number }) {
    const wf = await this.service.applyTemplate(body.templateId, Number(body.projectId));
    await this.items.cloneForWorkflow(body.templateId, wf.id);
    return wf;
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
    await this.items.deleteByWorkflow(id);
    return this.service.remove(id);
  }
}
