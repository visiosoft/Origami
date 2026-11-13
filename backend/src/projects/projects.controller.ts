import { Controller, Get, Post, Put, Delete, Param, Body, Query, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { Claims } from '../auth/guards/claims.decorator';
import { Tiers } from '../auth/guards/roles.decorator';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';

/**
 * Projects. Staff see and change all of them; clients, consultants and guests
 * see only the projects they're linked to, and change none.
 */
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService, private readonly access: ProjectAccessService) {}

  @Get()
  async findAll(@Claims() claims: SessionClaims | null, @Query('archived') archived?: string) {
    // Archived projects (Nov 13) only when asked for (?archived=only | all); internal ones never for outside accounts.
    const which = archived === 'only' || archived === 'all' ? archived : 'hide';
    const staff = this.access.isStaff(claims);
    const rows = (await this.access.filter(claims, await this.projectsService.findAll(which), (p: any) => p.id))
      .filter((p: any) => staff || p.kind !== 'internal');
    // The contract amount is a financial figure (Nov 10): only for roles that see project financials.
    if (await this.access.canView(claims, 'fin_project', 'fin_business')) return rows;
    return rows.map((p: any) => ({ ...p, contractAmt: null }));
  }

  /** Auto-archive (Nov 13): what switching it on would do -- administrators. */
  @Get('archive-plan')
  archivePlan(@Claims() claims: SessionClaims | null) {
    if (claims?.roleKey !== 'admin') throw new ForbiddenException('Only administrators manage the archive.');
    return this.projectsService.archivePreview();
  }

  @Post('archive-plan')
  applyArchive(@Claims() claims: SessionClaims | null) {
    if (claims?.roleKey !== 'admin') throw new ForbiddenException('Only administrators manage the archive.');
    return this.projectsService.applyArchive();
  }

  @Tiers('internal')
  @Post(':id/archive')
  async archive(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    await this.access.assert(claims, Number(id));
    return this.projectsService.setArchived(id, true);
  }

  @Tiers('internal')
  @Post(':id/restore')
  async restore(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    await this.access.assert(claims, Number(id));
    return this.projectsService.setArchived(id, false);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    await this.access.assert(claims, Number(id));
    const p = await this.projectsService.findOne(id);
    // As in the list: the contract amount only for roles that see project financials (K7).
    if (await this.access.canView(claims, 'fin_project', 'fin_business')) return p;
    return { ...p, contractAmt: null };
  }

  @Tiers('internal')
  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Tiers('internal')
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateProjectDto>, @Claims() claims: SessionClaims | null) {
    // Only a project the caller may see (Nov 10: any staff member could change any project).
    await this.access.assert(claims, Number(id));
    return this.projectsService.update(id, dto, { id: claims?.sub });
  }

  @Tiers('internal')
  @Delete(':id')
  async remove(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    await this.access.assert(claims, Number(id));
    return this.projectsService.remove(id);
  }
}
