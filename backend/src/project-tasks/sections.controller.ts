import { Controller, Get, Post, Put, Delete, Param, Query, Body, ForbiddenException } from '@nestjs/common';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';

/** Board columns (sections) are set up by leadership -- administrators and principals (Oct 27 sync). */
const adminOnly = (c?: SessionClaims | null) => { if (!COLUMN_EDITORS.includes(c?.roleKey || '')) throw new ForbiddenException('Only an administrator or principal can change the board’s columns.'); };
import { Tiers } from '../auth/guards/roles.decorator';
import { SectionsService } from './sections.service';
import { ProjectTasksService } from './project-tasks.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { COLUMN_EDITORS } from './board-columns';

@Tiers('internal')
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

  // ---- the same columns on every board (each project's and General) ----

  @Post('everywhere')
  addEverywhere(@Body() body: { name?: string }, @Claims() c?: SessionClaims | null) {
    adminOnly(c);
    return this.service.addEverywhere(String(body?.name || ''));
  }

  @Put('order-everywhere')
  reorderEverywhere(@Body() body: { names?: string[] }, @Claims() c?: SessionClaims | null) {
    adminOnly(c);
    return this.service.reorderEverywhere(Array.isArray(body?.names) ? body.names.map(String) : []);
  }

  /** Make every board carry this board's columns ('general' = the General board). */
  @Post('match/:projectId')
  matchAll(@Param('projectId') projectId: string, @Claims() c?: SessionClaims | null) {
    adminOnly(c);
    const pid = projectId === 'general' ? null : Number(projectId);
    return this.service.matchAll(pid, (from, to) => this.tasks.reparentTasks(from, to));
  }

  @Put(':id/everywhere')
  renameEverywhere(@Param('id') id: string, @Body() body: { name?: string }, @Claims() c?: SessionClaims | null) {
    adminOnly(c);
    return this.service.renameEverywhere(id, String(body?.name || ''));
  }

  @Delete(':id/everywhere')
  removeEverywhere(@Param('id') id: string, @Claims() c?: SessionClaims | null) {
    adminOnly(c);
    return this.service.removeEverywhere(id, (from, to) => this.tasks.reparentTasks(from, to));
  }

  @Post()
  create(@Body() dto: CreateSectionDto, @Claims() c?: SessionClaims | null) {
    adminOnly(c);
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateSectionDto>, @Claims() c?: SessionClaims | null) {
    adminOnly(c);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Claims() c?: SessionClaims | null) {
    adminOnly(c);
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
