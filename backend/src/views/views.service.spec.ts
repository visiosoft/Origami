import { ViewsService } from './views.service';

function table(rows: any[] = []) {
  const match = (r: any, w: any) => Object.entries(w || {}).every(([k, v]) => r[k] === v);
  return {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).map((r) => ({ ...r }))),
    findOneBy: jest.fn(async (w: any) => { const r = rows.find((x) => match(x, w)); return r ? { ...r } : null; }),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = { ...x }; else rows.push({ ...x }); return x; }),
    delete: jest.fn(async (w: any) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], w)) rows.splice(i, 1); }),
  } as any;
}

describe('saved views', () => {
  it('belong to one person and one page; saving a used name replaces it', async () => {
    const t = table();
    const s = new ViewsService(t);
    await s.save('U-1', { page: 'rfis', name: 'Overdue', filters: { status: 'open' } });
    await s.save('U-1', { page: 'rfis', name: 'overdue', filters: { status: 'late' } });
    await s.save('U-2', { page: 'rfis', name: 'Overdue', filters: { status: 'x' } });
    await s.save('U-1', { page: 'tasks.board', name: 'Mine', filters: { scope: 'mine' } });
    const mine = await s.list('U-1', 'rfis');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: 'overdue', filters: { status: 'late' } });
    expect(await s.list('U-2', 'rfis')).toHaveLength(1);
  });

  it('cannot delete someone else’s view, and refuses bad input', async () => {
    const t = table();
    const s = new ViewsService(t);
    const v = await s.save('U-1', { page: 'rfis', name: 'A', filters: {} });
    await expect(s.remove('U-2', v.id)).rejects.toThrow(/not found/);
    await expect(s.save('U-1', { page: 'Bad Page!', name: 'A' })).rejects.toThrow(/Unknown page/);
    await expect(s.save('U-1', { page: 'rfis', name: '  ' })).rejects.toThrow(/Name/);
    await s.remove('U-1', v.id);
    expect(t.rows).toHaveLength(0);
  });
});
