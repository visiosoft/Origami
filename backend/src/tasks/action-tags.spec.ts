import { cleanTags, internalOnly } from '../database/task.types';
import { scopeTasks } from '../database/viewer.util';
import { queryLog } from './task-query';

describe('access tags on special actions', () => {
  it('keeps known tags in order; Financial brings Internal with it, once', () => {
    expect(cleanTags(['Design', 'client', 'bogus', 'design'])).toEqual(['client', 'design']);
    expect(cleanTags(['financial'])).toEqual(['internal', 'financial']);
    // Already financial and Internal untagged by hand: it stays off.
    expect(cleanTags(['financial'], ['internal', 'financial'])).toEqual(['financial']);
    expect(internalOnly(['client'])).toBe(false);
    expect(internalOnly(['financial'])).toBe(true);
  });

  it('client and consultant accounts never see Internal or Financial items, even assigned to them', () => {
    const claims: any = { sub: 'C1', name: 'Kellen', tier: 'client' };
    const rows: any[] = [
      { id: 'a', assignedToId: 'C1', tags: ['client'] },
      { id: 'b', assignedToId: 'C1', tags: ['internal'] },
      { id: 'c', assignedToId: 'C1', tags: null },
    ];
    expect(scopeTasks(rows, claims).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('the log filters by tag and counts each', () => {
    const rows: any[] = [{ id: '1', tab: 'internal', tags: ['design'] }, { id: '2', tab: 'internal', tags: ['client', 'design'] }, { id: '3', tab: 'internal' }];
    const r = queryLog(rows, { id: 'U', name: 'E' }, { tag: 'client' });
    expect(r.rows.map((t: any) => t.id)).toEqual(['2']);
    expect(r.facets.tags).toMatchObject({ design: 2, client: 1, financial: 0 });
  });
});
