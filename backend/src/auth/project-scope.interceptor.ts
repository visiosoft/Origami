import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { ProjectAccessService } from './project-access.service';
import type { AuthedRequest } from './guards/session.guard';

/**
 * "Assigned projects" for a whole controller at once (Oct 30 sync): for a
 * caller limited to their projects, a project named in the route
 * (`projects/:id`) or the query (`?projectId=`) must be one of theirs, and
 * what comes back is narrowed to rows on their projects -- a list, a
 * `{ rows }` page, or a single record carrying `projectId`. Everyone who may
 * see every project passes straight through.
 */
@Injectable()
export class ProjectScope implements NestInterceptor {
  constructor(private readonly access: ProjectAccessService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.run(context, next));
  }

  private async run(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<AuthedRequest & { params: Record<string, string>; query: Record<string, string>; route?: { path?: string } }>();
    const claims = req.claims;
    const allowed = claims ? await this.access.allowedIds(claims) : 'all';
    if (allowed === 'all') return lastValueFrom(next.handle());
    const mine = (id: unknown) => id == null || id === '' || allowed.has(Number(id));
    const path = String(req.route?.path || '');
    if (/projects\/:id\b/.test(path) && !mine(req.params?.id)) throw new ForbiddenException('You don’t have access to this project.');
    if (req.query?.projectId && !mine(req.query.projectId)) throw new ForbiddenException('You don’t have access to this project.');
    const out = await lastValueFrom(next.handle());
    return narrow(out, allowed);
  }
}

/** Rows on the allowed projects; rows that carry no project are left as they are. */
export function narrow(out: unknown, allowed: Set<number>): unknown {
  const keep = (r: any) => !r || typeof r !== 'object' || !('projectId' in r) || r.projectId == null || allowed.has(Number(r.projectId));
  if (Array.isArray(out)) return out.filter(keep);
  if (out && typeof out === 'object') {
    const o = out as Record<string, any>;
    if (Array.isArray(o.rows)) return { ...o, rows: o.rows.filter(keep) };
    if ('projectId' in o && o.projectId != null && !allowed.has(Number(o.projectId))) throw new ForbiddenException('You don’t have access to this project.');
  }
  return out;
}
