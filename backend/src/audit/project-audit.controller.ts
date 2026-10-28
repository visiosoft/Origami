import { Controller, Get, Param } from '@nestjs/common';
import { Tiers } from '../auth/guards/roles.decorator';
import { AuditService } from './audit.service';

/**
 * A project's audit trail, under its Overview (Oct 27 sync: "restore the audit
 * trail"). Internal staff only; finance entries stay in the admin audit log,
 * since money details are for finance roles.
 */
@Tiers('internal')
@Controller('audit-project')
export class ProjectAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get(':projectId')
  async list(@Param('projectId') projectId: string) {
    const id = Number(projectId);
    if (!Number.isFinite(id) || id <= 0) return [];
    const rows = await this.audit.list({ projectId: String(id), limit: '200' });
    return rows.filter((r) => r.source !== 'finance').slice(0, 100);
  }
}
