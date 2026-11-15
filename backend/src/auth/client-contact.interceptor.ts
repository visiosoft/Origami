import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { ProjectAccessService } from './project-access.service';
import type { AuthedRequest } from './guards/session.guard';

/** A lead's (client's) ways to reach them. The project address stays: the site team needs it. */
export const CLIENT_CONTACT_KEYS = ['phone', 'email', 'phoneOfSecondContact', 'emailOfSecondContact', 'leadSourceReferrerPhone', 'clientPhone', 'clientEmail'];

/** Blank those fields wherever they appear (lists, `{ rows }`, single records, version snapshots), a few levels deep. */
export function stripClientContacts<T>(v: T, depth = 0): T {
  if (depth > 4 || v == null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => stripClientContacts(x, depth + 1)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    out[k] = CLIENT_CONTACT_KEYS.includes(k) && (typeof x === 'string' || x == null) ? (x ? '' : x) : stripClientContacts(x, depth + 1);
  }
  return out as T;
}

/**
 * CRM records without the client's phone and email below internal level 2
 * (Nov 10 sync, PEOPLE ACCESS sheet: superintendents saw clients' details).
 */
@Injectable()
export class ClientContactScope implements NestInterceptor {
  constructor(private readonly access: ProjectAccessService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const hide = !this.access.seesClientContacts(req.claims ?? null);
    return next.handle().pipe(map((out) => (hide && req.method === 'GET' ? stripClientContacts(out) : out)));
  }
}
