import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
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
  async findAll(@Claims() claims: SessionClaims | null) {
    const rows = await this.access.filter(claims, await this.projectsService.findAll(), (p: any) => p.id);
    // The contract amount is a financial figure (Nov 10): only for roles that see project financials.
    if (await this.access.canView(claims, 'fin_project', 'fin_business')) return rows;
    return rows.map((p: any) => ({ ...p, contractAmt: null }));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    await this.access.assert(claims, Number(id));
    return this.projectsService.findOne(id);
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
