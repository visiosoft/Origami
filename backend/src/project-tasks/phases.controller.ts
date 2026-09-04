import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PhasesService } from './phases.service';
import { CreatePhaseDto } from './dto/create-phase.dto';

@Controller('project-phases')
export class PhasesController {
  constructor(private readonly service: PhasesService) {}

  /** A project's phases — the standard six are created on first read. */
  @Get()
  findAll(@Query('projectId') projectId: string) {
    return this.service.forProject(Number(projectId));
  }

  /** { phases, tasks } for the Phase Board. */
  /** Every project's design progress, for the Design board. */
  /** The programme template new projects are built from. */
  @Get('template')
  getTemplate() {
    return this.service.getTemplate();
  }

  @Put('template')
  saveTemplate(@Body() body: unknown) {
    return this.service.saveTemplate(body);
  }

  /** Back to the shipped default. */
  @Delete('template')
  resetTemplate() {
    return this.service.saveTemplate(null);
  }

  /** Bring one project's board up to the current template. */
  @Post('apply-template')
  applyTemplate(@Query('projectId') projectId: string) {
    return this.service.applyTemplate(Number(projectId));
  }

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('board')
  board(@Query('projectId') projectId: string) {
    const pid = Number(projectId);
    if (!Number.isFinite(pid)) return { phases: [], tasks: [] };
    return this.service.board(pid);
  }

  @Post()
  create(@Body() dto: CreatePhaseDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePhaseDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
