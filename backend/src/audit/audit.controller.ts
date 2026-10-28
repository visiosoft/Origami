import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/guards/roles.decorator';
import { AuditService } from './audit.service';

@Roles('admin')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** The audit log, newest first. Filters: from, to (YYYY-MM-DD), type, user, projectId, q, limit. */
  @Get()
  list(@Query() q: Record<string, string>) {
    return this.audit.list(q);
  }
}
