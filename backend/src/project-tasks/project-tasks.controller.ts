import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';
import { ProjectTasksService } from './project-tasks.service';
import { CreateProjectTaskDto } from './dto/create-project-task.dto';

@Controller('project-tasks')
export class ProjectTasksController {
  constructor(private readonly service: ProjectTasksService) {}

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.service.findAll(projectId ? Number(projectId) : undefined);
  }

  @Get('board')
  board(@Query('projectId') projectId: string) {
    const pid = Number(projectId);
    if (!Number.isFinite(pid)) return { sections: [], tasks: [] };
    return this.service.board(pid);
  }

  @Post()
  create(@Body() dto: CreateProjectTaskDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProjectTaskDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
