import { ForbiddenException } from '@nestjs/common';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PhasesService } from './phases.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { Claims } from '../auth/guards/claims.decorator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';
import { Perm } from '../auth/guards/perm.guard';


@Perm('projects', 'tasks', 'design', 'pm')
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

  /** Every project's phases with their dates, for the Schedule. */
  @Tiers('internal')
  @Get('schedule')
  schedule() {
    return this.service.schedule();
  }

  @Tiers('internal')
  @Get('overview')
  async overview(@Claims() claims: SessionClaims | null) {
    const rows = await this.service.overview();
    // The contract amount is a financial figure (K7): only for roles that see project financials.
    if (await this.access.canView(claims, 'fin_project', 'fin_business')) return rows;
    return (rows as any[]).map((r) => ({ ...r, contractAmt: null }));
  }

  /** The project team (Nov 13): who fills each role, and open tasks waiting on empty roles. */
  @Get('team')
  async team(@Query('projectId') projectId: string, @Claims() claims: SessionClaims | null) {
    await this.access.assert(claims ?? null, Number(projectId));
    return this.service.team(Number(projectId));
  }

  /** Change who fills the roles; their open, unassigned tasks follow. Staff who manage projects. */
  @Tiers('internal')
  @Put('team')
  async setTeam(@Body() body: { projectId: number; roles: Record<string, string> }, @Claims() claims: SessionClaims | null) {
    await this.access.assert(claims ?? null, Number(body?.projectId));
    if (!(await this.access.canManage(claims ?? null, 'projects', 'pm'))) throw new ForbiddenException('Your role doesn’t allow changing the project team.');
    return this.service.setTeam(Number(body?.projectId), body?.roles || {});
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

  /** Structures on the lot (Batch 6): add one (its phases are copied from the programme), rename, remove. */
  @Tiers('internal')
  @Post('structures')
  async addStructure(@Body() body: { projectId: number; name: string; mainName?: string }, @Claims() claims: SessionClaims | null) {
    await this.structureAccess(claims, Number(body?.projectId));
    return this.service.addStructure(Number(body?.projectId), body?.name, body?.mainName);
  }

  @Tiers('internal')
  @Put('structures/:key')
  async renameStructure(@Param('key') key: string, @Body() body: { projectId: number; name: string }, @Claims() claims: SessionClaims | null) {
    await this.structureAccess(claims, Number(body?.projectId));
    return this.service.renameStructure(Number(body?.projectId), key, body?.name);
  }

  @Tiers('internal')
  @Delete('structures/:key')
  async removeStructure(@Param('key') key: string, @Query('projectId') projectId: string, @Claims() claims: SessionClaims | null) {
    await this.structureAccess(claims, Number(projectId));
    return this.service.removeStructure(Number(projectId), key);
  }

  private async structureAccess(claims: SessionClaims | null, projectId: number) {
    await this.access.assert(claims ?? null, projectId);
    if (!(await this.access.canManage(claims ?? null, 'projects', 'pm'))) throw new ForbiddenException('Your role doesn’t allow changing the project’s structures.');
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
