import { CallHandler, ExecutionContext, Injectable, NestInterceptor, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { Repository } from 'typeorm';
import { PersonEntity } from '../database/entities';
import { ProjectAccessService } from '../auth/project-access.service';
import type { AuthedRequest } from '../auth/guards/session.guard';

/** Our own team: always visible to staff. */
export const INTERNAL_KINDS = /^(staff|internal|employee)/i;
/** What a client record shouldn't show below internal level 2. */
const CLIENT_CONTACT_FIELDS = ['phone', 'email', 'addresses', 'contactInfo'] as const;

/** Is this person visible to an "Assigned projects" caller? Themselves, our team, or someone on one of their projects. */
export function personVisible(p: Partial<PersonEntity>, names: Set<string>, sub: string | undefined, staff: boolean): boolean {
  if (sub && p.userId === sub) return true;
  if (staff && INTERNAL_KINDS.test(String(p.kind || ''))) return true;
  return (p.projects || []).some((n) => names.has(n));
}

/** A client's phone, email and address taken off (for field roles). */
export function withoutClientContact<T extends Record<string, any>>(p: T): T {
  if (!p || typeof p !== 'object' || String(p.kind || '').toLowerCase() !== 'client') return p;
  const out: Record<string, any> = { ...p };
  for (const k of CLIENT_CONTACT_FIELDS) if (k in out) out[k] = k === 'phone' || k === 'email' ? '' : null;
  out.contactHidden = true;
  return out as T;
}

/**
 * Who sees which contacts (Nov 10 sync: a superintendent could open any
 * contact by its id, search the whole directory for duplicates, and see
 * clients' phone numbers and emails).
 * - A route about one contact (`:id`) answers only when that contact is
 *   visible to the caller; otherwise "not found".
 * - Lists and the duplicate search are narrowed the same way.
 * - Below internal level 2 (field roles), clients come without phone, email
 *   or address.
 */
@Injectable()
export class PersonScope implements NestInterceptor {
  constructor(
    private readonly access: ProjectAccessService,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return from(this.run(context, next));
  }

  private async run(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<AuthedRequest & { params: Record<string, string>; route?: { path?: string } }>();
    const claims = req.claims ?? null;
    const names = await this.access.allowedNames(claims);
    const whole = names === 'all' && (await this.access.canView(claims, 'people'));
    const staff = this.access.isStaff(claims);
    // Same rule as the list: the whole directory with the People module on all projects; otherwise ourselves, our team, and people on our projects.
    const visible = (p: Partial<PersonEntity>) => whole || personVisible(p, names === 'all' ? new Set() : names, claims?.sub, staff);
    const path = String(req.route?.path || '');

    // One contact by id: only if visible (writes included -- the module rights are checked by the guards).
    for (const key of ['id', 'otherId']) {
      const raw = req.params?.[key];
      if (!raw || !/:(id|otherId)\b/.test(path)) continue;
      const p = await this.people.findOne({ where: { id: Number(raw) }, select: { id: true, kind: true, projects: true, userId: true } as any });
      if (p && !visible(p)) throw new NotFoundException('Contact not found');
    }

    const out = await lastValueFrom(next.handle());
    const redact = !this.access.seesClientContacts(claims);
    const shape = (p: any) => (redact ? withoutClientContact(p) : p);
    if (Array.isArray(out)) {
      // The duplicate search returns bare rows; narrow them like the list.
      const rows = /duplicates/.test(path) && !whole
        ? await this.visibleRows(out, visible)
        : out;
      return rows.map(shape);
    }
    if (out && typeof out === 'object' && 'kind' in (out as any)) return shape(out);
    return out;
  }

  private async visibleRows(rows: any[], visible: (p: Partial<PersonEntity>) => boolean) {
    if (!rows.length) return rows;
    const full = await this.people.find({ select: { id: true, kind: true, projects: true, userId: true } as any });
    const byId = new Map(full.map((p) => [p.id, p]));
    return rows.filter((r) => { const p = byId.get(Number(r.id)); return p ? visible(p) : false; });
  }
}
