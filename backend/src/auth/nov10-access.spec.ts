import { of } from 'rxjs';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectScope } from './project-scope.interceptor';
import { ProjectAccessService } from './project-access.service';
import { stripClientContacts } from './client-contact.interceptor';
import { PersonScope, personVisible, withoutClientContact } from '../people/person-scope.interceptor';

// Nov 10 sync: a superintendent could still reach other projects and clients' details.
const ctx = (req: any) => ({ switchToHttp: () => ({ getRequest: () => req }) }) as any;
const handler = (out: unknown) => ({ handle: () => of(out) });
const super_ = { sub: 'U-G', name: 'George', roleKey: 'r_internal_super', tier: 'internal' } as any;
const pm = { sub: 'U-P', name: 'Pat', roleKey: 'r_internal_project_manager', tier: 'internal' } as any;

describe('Nov 10 access rules', () => {
  it('routes naming :projectId are checked against the caller’s projects', async () => {
    const scope = new ProjectScope({ allowedIds: async () => new Set([7]) } as any);
    await expect((scope as any).run(ctx({ claims: super_, params: { projectId: '8' }, query: {}, route: { path: '/audit-project/:projectId' } }), handler([])))
      .rejects.toBeInstanceOf(ForbiddenException);
    const rows = await (scope as any).run(ctx({ claims: super_, params: { projectId: '7' }, query: {}, route: { path: '/audit-project/:projectId' } }), handler([{ projectId: 7 }, { projectId: 8 }]));
    expect(rows).toEqual([{ projectId: 7 }]);
  });

  it('field roles don’t see clients’ phone and email; office staff do', () => {
    const svc = new ProjectAccessService({} as any, {} as any);
    expect(svc.seesClientContacts(super_)).toBe(false);
    expect(svc.seesClientContacts({ ...super_, roleKey: 'r_internal_foreman_lead' })).toBe(false);
    expect(svc.seesClientContacts(pm)).toBe(true);
    expect(svc.seesClientContacts({ ...pm, roleKey: 'admin' })).toBe(true);
    expect(svc.seesClientContacts(null)).toBe(false);
  });

  it('CRM records lose client phone/email (not the site address), at any depth', () => {
    const lead = { id: 'L1', name: 'Catherine', phone: '650 555 0101', email: 'c@x.test', projectStreetAddress: '12 Elm St', versions: [{ data: { email: 'old@x.test' } }] };
    expect(stripClientContacts(lead)).toEqual({ id: 'L1', name: 'Catherine', phone: '', email: '', projectStreetAddress: '12 Elm St', versions: [{ data: { email: '' } }] });
    expect(stripClientContacts({ rows: [lead] }).rows[0].phone).toBe('');
  });

  it('a client contact loses phone, email and address; a sub keeps theirs', () => {
    expect(withoutClientContact({ kind: 'Client', name: 'Catherine', phone: '1', email: 'e', addresses: { home: 'x' } })).toEqual({ kind: 'Client', name: 'Catherine', phone: '', email: '', addresses: null, contactHidden: true });
    expect(withoutClientContact({ kind: 'Sub', phone: '1' })).toEqual({ kind: 'Sub', phone: '1' });
  });

  it('a contact is visible to an assigned-projects caller only if it’s theirs, our team, or on their projects', () => {
    const mine = new Set(['Catherine bathrooms']);
    expect(personVisible({ kind: 'Client', projects: ['Catherine bathrooms'] }, mine, 'U-G', true)).toBe(true);
    expect(personVisible({ kind: 'Client', projects: ['Smith kitchen'] }, mine, 'U-G', true)).toBe(false);
    expect(personVisible({ kind: 'Staff', projects: [] }, mine, 'U-G', true)).toBe(true);
    expect(personVisible({ kind: 'Consultant', projects: [], userId: 'U-G' }, mine, 'U-G', true)).toBe(true);
  });

  it('opening another project’s contact by id is "not found"; lists and duplicates are narrowed and redacted', async () => {
    const people = [
      { id: 1, kind: 'Client', projects: ['Catherine bathrooms'], phone: '650', email: 'c@x.test', name: 'Catherine' },
      { id: 2, kind: 'Client', projects: ['Smith kitchen'], phone: '408', email: 's@x.test', name: 'Sam Smith' },
    ];
    const access = { allowedNames: async () => new Set(['Catherine bathrooms']), canView: async () => true, isStaff: () => true, seesClientContacts: () => false } as any;
    const repo = { findOne: async (o: any) => people.find((p) => p.id === o.where.id) || null, find: async () => people } as any;
    const scope = new PersonScope(access, repo);
    const run = (req: any, out: unknown) => (scope as any).run(ctx({ claims: super_, ...req }), handler(out));
    await expect(run({ params: { id: '2' }, route: { path: '/people/:id' } }, people[1])).rejects.toBeInstanceOf(NotFoundException);
    const one = await run({ params: { id: '1' }, route: { path: '/people/:id' } }, people[0]);
    expect(one).toMatchObject({ name: 'Catherine', phone: '', email: '', contactHidden: true });
    const dups = await run({ params: {}, route: { path: '/people/duplicates' } }, people);
    expect(dups.map((p: any) => p.id)).toEqual([1]);
  });
});
