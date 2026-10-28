import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { AuthedRequest } from '../auth/guards/session.guard';
import { bodyChanges, describeRequest, diffFields, labelOf, projectOf, TRACKED } from './audit-route';
import { AuditService } from './audit.service';

/**
 * Writes the audit log: every change a signed-in person saves through the API
 * -- who, when, which record and (for the main records) what changed. Runs
 * after the request succeeds; a failed save isn't logged as a change.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const what = req.claims ? describeRequest(req.method, req.originalUrl || req.url) : null;
    if (!what) return next.handle();
    const tracked = !!TRACKED[what.segment];
    const before = tracked && what.entityId ? await this.audit.load(what.segment, what.entityId) : null;
    const claims = req.claims!;
    return next.handle().pipe(tap((result: any) => {
      void (async () => {
        const id = what.entityId ?? (result && typeof result === 'object' && !Array.isArray(result) && (result.id ?? result.key) != null ? String(result.id ?? result.key) : null);
        const after = tracked && id && req.method !== 'DELETE' ? await this.audit.load(what.segment, id) : null;
        const changes = tracked && (before || after) ? diffFields(before, after) : bodyChanges(req.body);
        // An autosave that changed nothing isn't an event.
        if (tracked && (before || after) && req.method !== 'DELETE' && req.method !== 'POST' && !changes.length) return;
        const row = after || before;
        await this.audit.record({
          userId: claims.sub || null, userName: claims.name || claims.email || null,
          entityType: what.entityType, entityId: id, label: labelOf(row), action: what.action,
          projectId: projectOf(what.segment, row), method: req.method, path: (req.originalUrl || req.url).split('?')[0].slice(0, 300), changes,
        });
      })();
    }));
  }
}
