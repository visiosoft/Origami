import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ProjectAccessService } from '../auth/project-access.service';
import { Perm } from '../auth/guards/perm.guard';
import { Tiers } from '../auth/guards/roles.decorator';
import { Claims } from '../auth/guards/claims.decorator';
import type { SessionClaims } from '../auth/crypto.util';
import { ChecklistTemplatesService } from './checklist-templates.service';

const who = (c: SessionClaims | null) => ({ id: c?.sub, name: c?.name || 'Unknown', roleKey: c?.roleKey });

@Tiers('internal')
@Controller('checklist-templates')
export class ChecklistTemplatesController {
  constructor(private readonly service: ChecklistTemplatesService, private readonly access: ProjectAccessService) {}

  /** QA/QC checklists are made and changed by people who manage QA/QC (Nov 13); other checklists as before. */
  private async qaqcGuard(c: SessionClaims | null, kind: unknown) {
    if (kind === 'qaqc' && !(await this.access.canManage(c, 'quality'))) throw new ForbiddenException('Only people who manage QA/QC can change QA/QC checklists.');
  }

  @Get() list() { return this.service.list(); }
  /** QA/QC checklists on tasks, across the caller's projects (optionally one: ?projectId=). */
  @Perm('quality')
  @Get('qaqc') async qaqc(@Query('projectId') projectId: string | undefined, @Claims() c: SessionClaims | null) {
    const allowed = await this.access.allowedIds(c);
    const one = Number(projectId) || null;
    return this.service.qaqc((id) => (one == null || id === one) && (allowed === 'all' || allowed.has(id)));
  }
  @Post() async save(@Body() dto: any, @Claims() c: SessionClaims | null) {
    await this.qaqcGuard(c, dto?.kind);
    const t = await this.service.save(dto || {}, who(c));
    const applied = await this.service.applyToExisting(t as any);
    return { ...t, applied };
  }
  @Put(':id') async update(@Param('id') id: string, @Body() dto: any, @Claims() c: SessionClaims | null) {
    await this.qaqcGuard(c, dto?.kind ?? (await this.service.kindOf(id)));
    if ((await this.service.kindOf(id)) === 'qaqc') await this.qaqcGuard(c, 'qaqc');
    const t = await this.service.update(id, dto || {}, who(c));
    const applied = await this.service.applyToExisting(t as any);
    return { ...t, applied };
  }
  @Delete(':id') async remove(@Param('id') id: string, @Claims() c: SessionClaims | null) {
    await this.qaqcGuard(c, await this.service.kindOf(id));
    return this.service.remove(id, who(c));
  }
}
