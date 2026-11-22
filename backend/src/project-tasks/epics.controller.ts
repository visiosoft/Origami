import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Claims } from '../auth/guards/claims.decorator';
import { Tiers } from '../auth/guards/roles.decorator';
import { Perm } from '../auth/guards/perm.guard';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';
import { EpicsService } from './epics.service';

export class EpicDto {
  @IsOptional() projectId?: number | null;
  @IsString() @IsOptional() @MaxLength(120) name?: string;
  @IsString() @IsOptional() @MaxLength(20) color?: string;
  @IsString() @IsOptional() @MaxLength(10) dueDate?: string | null;
  @IsInt() @IsOptional() order?: number;
}

/** Nov 17: a board's epics (staff only). ?projectId= blank or "general" for General Tasks. */
@Tiers('internal')
@Perm('projects', 'tasks', 'design', 'pm')
@Controller('project-epics')
export class EpicsController {
  constructor(private readonly service: EpicsService, private readonly access: ProjectAccessService) {}

  private pid(v: unknown): number | null {
    const n = Number(v);
    return v === undefined || v === null || v === '' || v === 'general' || !Number.isFinite(n) ? null : n;
  }

  @Get()
  async list(@Query('projectId') projectId: string, @Claims() claims: SessionClaims | null) {
    const pid = this.pid(projectId);
    if (pid != null) await this.access.assert(claims, pid);
    return this.service.list(pid);
  }

  @Post()
  async create(@Body() dto: EpicDto, @Claims() claims: SessionClaims | null) {
    const pid = this.pid(dto.projectId);
    if (pid != null) await this.access.assert(claims, pid);
    return this.service.create({ ...dto, projectId: pid });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: EpicDto, @Claims() claims: SessionClaims | null) {
    const e = await this.service.get(id);
    if (e.projectId != null) await this.access.assert(claims, e.projectId);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Claims() claims: SessionClaims | null) {
    const e = await this.service.get(id);
    if (e.projectId != null) await this.access.assert(claims, e.projectId);
    return this.service.remove(id);
  }
}
