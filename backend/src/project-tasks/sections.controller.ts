import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { ProjectTasksService } from './project-tasks.service';
import { CreateSectionDto } from './dto/create-section.dto';

@Controller('project-sections')
export class SectionsController {
  constructor(
    private readonly service: SectionsService,
    private readonly tasks: ProjectTasksService,
  ) {}

  @Get()
  findAll(@Query('projectId') projectId: string) {
    return this.service.forProject(Number(projectId));
  }

  @Post()
  create(@Body() dto: CreateSectionDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateSectionDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    // Reparent this section's tasks to a sibling (or delete them if it was the
    // last section) so tasks never orphan — works in both DB and in-memory mode.
    const section = await this.service.getById(id);
    if (section) {
      const siblings = (await this.service.forProject(section.projectId)).filter((s) => s.id !== id);
      if (siblings.length) await this.tasks.reparentTasks(id, siblings[0].id);
      else await this.tasks.deleteTasksInSection(id);
    }
    return this.service.remove(id);
  }
}
