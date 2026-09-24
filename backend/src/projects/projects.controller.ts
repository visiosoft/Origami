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
    return this.access.filter(claims, await this.projectsService.findAll(), (p: any) => p.id);
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
  update(@Param('id') id: string, @Body() dto: Partial<CreateProjectDto>) {
    return this.projectsService.update(id, dto);
  }

  @Tiers('internal')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
