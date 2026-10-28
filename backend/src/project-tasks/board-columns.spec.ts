import { alignPlan, orderedBy } from './board-columns';
import { SectionsService } from './sections.service';

const col = (id: string, name: string, order: number, projectId: number | null = 1) => ({ id, name, order, projectId });

describe('the same columns on every board', () => {
  it('plans a board to carry exactly the template, matching by name', () => {
    const plan = alignPlan(['To Do', 'In Progress', 'Done'], [col('a', 'to do', 0), col('b', 'Waiting', 1), col('c', 'Done', 2)]);
    expect(plan.keep).toEqual([{ id: 'a', name: 'To Do', order: 0 }, { id: 'c', name: 'Done', order: 2 }]);
    expect(plan.create).toEqual([{ name: 'In Progress', order: 1 }]);
    expect(plan.remove).toEqual(['b']);
  });

  it('orders a board by the template, unknown columns last', () => {
    expect(orderedBy(['Done', 'To Do'], [col('a', 'To Do', 0), col('x', 'Extra', 1), col('c', 'Done', 2)])).toEqual([
      { id: 'c', order: 0 }, { id: 'a', order: 1 }, { id: 'x', order: 2 },
    ]);
  });

  // An in-memory repo with just what SectionsService uses.
  const memRepo = (rows: any[]) => ({
    rows,
    find: jest.fn(async (opts?: any) => {
      const where = opts?.where;
      let out = rows;
      if (where && 'projectId' in where) out = rows.filter((r) => (typeof where.projectId === 'object' ? r.projectId == null : r.projectId === where.projectId));
      return [...out].sort((a, b) => a.order - b.order);
    }),
    findOneBy: jest.fn(async ({ id }: any) => rows.find((r) => r.id === id) || null),
    save: jest.fn(async (x: any) => { for (const r of [].concat(x)) { const i = rows.findIndex((o) => o.id === (r as any).id); if (i >= 0) rows[i] = r; else rows.push(r); } return x; }),
    update: jest.fn(async ({ id }: any, patch: any) => { Object.assign(rows.find((r) => r.id === id), patch); }),
    delete: jest.fn(async ({ id }: any) => { rows.splice(rows.findIndex((r) => r.id === id), 1); }),
    count: jest.fn(async () => rows.length),
  });
  const service = (rows: any[]) => { const repo = memRepo(rows); return { svc: new SectionsService(repo as any), repo }; };
  const names = (rows: any[], pid: number | null) => rows.filter((r) => r.projectId === pid).sort((a, b) => a.order - b.order).map((r) => r.name);

  it('adds, renames and removes a column on every board, moving tasks to the first column left', async () => {
    const rows = [col('g1', 'To Do', 0, null), col('g2', 'Review', 1, null), col('p1', 'To Do', 0, 7), col('p2', 'review', 1, 7)];
    const { svc } = service(rows);
    await svc.addEverywhere('Blocked');
    expect(names(rows, null)).toEqual(['To Do', 'Review', 'Blocked']);
    expect(names(rows, 7)).toEqual(['To Do', 'review', 'Blocked']);
    await svc.renameEverywhere('g2', 'In Review');
    expect(names(rows, 7)).toEqual(['To Do', 'In Review', 'Blocked']);
    const moves: string[] = [];
    expect(await svc.removeEverywhere('g2', async (from, to) => { moves.push(`${from}->${to}`); })).toEqual({ removed: 2 });
    expect(moves).toEqual(['g2->g1', 'p2->p1']);
    expect(names(rows, 7)).toEqual(['To Do', 'Blocked']);
  });

  it('makes every board match one board, keeping tasks', async () => {
    const rows = [col('g1', 'To Do', 0, null), col('g2', 'Done', 1, null), col('p1', 'Doing', 0, 7), col('p2', 'done', 1, 7)];
    const { svc } = service(rows);
    const moves: string[] = [];
    expect(await svc.matchAll(null, async (from, to) => { moves.push(`${from}->${to}`); })).toEqual({ boards: 1 });
    expect(names(rows, 7)).toEqual(['To Do', 'Done']);
    expect(moves).toHaveLength(1);
    expect(moves[0].startsWith('p1->')).toBe(true);
  });

  it('starts a new project board with the General board’s headings', async () => {
    const rows = [col('g1', 'Inbox', 0, null), col('g2', 'Working', 1, null)];
    const { svc } = service(rows);
    expect((await svc.forProject(9)).map((r: any) => r.name)).toEqual(['Inbox', 'Working']);
  });
});
