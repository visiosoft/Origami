import { queryLog, GENERAL_PF } from './task-query';
import { pageArgs, pageOf, MAX_PAGE_SIZE } from '../common/paging';

const me = { id: 'U-1', name: 'Edward' };
const kai = { id: 'U-2', name: 'Kai Lono' };
const rows = [
  { id: 'A', tab: 'internal', subject: 'Order tile', project: 'Narvaes', assignedToId: 'U-1', meetingDate: '2026-10-01', labels: ['Procurement'] },
  { id: 'B', tab: 'internal', subject: 'Call plumber', project: 'Narvaes', assignedToId: 'U-2', createdById: 'U-1', meetingDate: '2026-10-05' },
  { id: 'C', tab: 'internal', subject: 'General item', assignedTo: 'kai lono', meetingDate: '2026-10-03' },
  { id: 'D', tab: 'owner', subject: 'Owner thing', project: 'Chelliah', meetingDate: '2026-10-02' },
  { id: 'E', tab: 'internal', subject: 'Old one', project: 'Narvaes', archivedAt: '2026-09-01', meetingDate: '2026-09-01' },
  { id: 'F', tab: 'internal', subject: 'For a lead', leadId: 'L-1', leadName: 'Jo Smith', meetingDate: '2026-10-04' },
];

describe('Special Actions Log query', () => {
  it('pages, counts tabs and leaves archived entries out unless asked', () => {
    const r = queryLog(rows, me, { tab: 'internal', size: 2, page: 1, sort: 'date', dir: 'desc' });
    expect(r.total).toBe(4);
    expect(r.pages).toBe(2);
    expect(r.rows.map((x) => x.id)).toEqual(['B', 'F']);
    expect(r.counts.tabs).toEqual({ internal: 4, owner: 1, subcontractor: 0 });
    expect(r.counts.archived).toBe(1);
    expect(queryLog(rows, me, { tab: 'internal', archived: true }).rows.map((x) => x.id)).toEqual(['E']);
  });

  it('filters by project, General and lead, and searches', () => {
    expect(queryLog(rows, me, { pf: 'Narvaes' }).rows.map((x) => x.id)).toEqual(['A', 'B']);
    expect(queryLog(rows, me, { pf: GENERAL_PF }).rows.map((x) => x.id)).toEqual(['C']);
    expect(queryLog(rows, me, { pf: 'Lead · Jo Smith' }).rows.map((x) => x.id)).toEqual(['F']);
    expect(queryLog(rows, me, { q: 'procure' }).rows.map((x) => x.id)).toEqual(['A']);
    const f = queryLog(rows, me, {}).facets;
    expect(f.projects).toEqual(['Narvaes', 'Chelliah', 'Lead · Jo Smith']);
    expect(f.hasGeneral).toBe(true);
    expect(f.labels).toEqual(['Procurement']);
  });

  it('scopes: mine, from me, assigned to a person (by id or name)', () => {
    expect(queryLog(rows, me, { scope: 'mine' }).rows.map((x) => x.id)).toEqual(['A', 'B']);
    expect(queryLog(rows, me, { scope: 'mine', parts: { assigned: true, collab: false, originated: false } }).rows.map((x) => x.id)).toEqual(['A']);
    expect(queryLog(rows, me, { scope: 'fromMe' }).rows.map((x) => x.id)).toEqual(['B']);
    expect(queryLog(rows, me, { scope: 'assigned', person: kai }).rows.map((x) => x.id)).toEqual(['B', 'C']);
    expect(queryLog(rows, me, { scope: 'mine', restricted: true }).total).toBe(4);
    expect(queryLog(rows, me, {}).counts.scope).toEqual({ all: 4, mine: 2, fromMe: 1, assigned: 3 });
  });
});

describe('paging', () => {
  it('caps the page size and clamps the page', () => {
    expect(pageArgs('3', '9999')).toEqual({ page: 3, size: MAX_PAGE_SIZE });
    expect(pageArgs(undefined, undefined)).toEqual({ page: 1, size: 50 });
    expect(pageOf([1, 2, 3], { page: 9, size: 2 })).toEqual({ rows: [3], total: 3, page: 2, size: 2, pages: 2 });
    expect(pageOf([], { page: 1, size: 2 })).toEqual({ rows: [], total: 0, page: 1, size: 2, pages: 1 });
  });
});
