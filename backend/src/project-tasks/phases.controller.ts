import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PhasesService } from './phases.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { Claims } from '../auth/guards/claims.decorator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';


@Controller('project-phases')
export class PhasesController {
  constructor(private readonly service: PhasesService, private readonly access: ProjectAccessService) {}

  /** A project's phases — the standard six are created on first read. */
  @Get()
  async findAll(@Query('projectId') projectId: string, @Claims() claims: SessionClaims | null) {
    await this.access.assert(claims, Number(projectId));
    return this.service.forProject(Number(projectId));
  }

  /** { phases, tasks } for the Phase Board. */
  /** Every project's design progress, for the Design board. */
  /** The office's library of named programmes new projects are built from. */
  @Tiers('internal')
  @Get('templates')
  listTemplates() {
    return this.service.listTemplates();
  }

  /** Create (omit key) or replace (pass key) one named template. */
  @Tiers('internal')
  @Put('templates')
  saveTemplate(@Body() body: { key?: string; name: string; phases: unknown; projectTypes?: unknown; category?: unknown }) {
    return this.service.saveTemplateEntry(body?.key, body?.name, body?.phases, body?.projectTypes, body?.category);
  }

  @Tiers('internal')
  @Delete('templates/:key')
  deleteTemplate(@Param('key') key: string) {
    return this.service.deleteTemplateEntry(key);
  }

  /** Bring one project's board up to the current template. */
  @Tiers('internal')
  @Post('apply-template')
  applyTemplate(@Query('projectId') projectId: string) {
    return this.service.applyTemplate(Number(projectId));
  }

  @Tiers('internal')
  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('board')
  async board(@Query('projectId') projectId: string, @Claims() claims: SessionClaims | null) {
    const pid = Number(projectId);
    if (!Number.isFinite(pid)) return { phases: [], tasks: [] };
    await this.access.assert(claims, pid);
    return this.service.board(pid);
  }

  @Tiers('internal')
  @Post()
  create(@Body() dto: CreatePhaseDto) {
    return this.service.create(dto);
  }

  /** Give a project a phase (and its template tasks) it doesn't have yet. */
  @Tiers('internal')
  @Post('adopt')
  adopt(@Body() body: { projectId: number; key: string }) {
    return this.service.adoptPhase(Number(body?.projectId), body?.key);
  }

  @Tiers('internal')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePhaseDto>) {
    return this.service.update(id, dto);
  }

  @Tiers('internal')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
