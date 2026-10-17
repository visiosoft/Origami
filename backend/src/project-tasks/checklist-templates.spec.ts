import { ChecklistTemplatesService } from './checklist-templates.service';

function table(rows: any[] = []) {
  const match = (r: any, w: any) => Object.entries(w || {}).every(([k, v]) => r[k] === v);
  return {
    rows,
    find: jest.fn(async () => rows.map((r) => ({ ...r }))),
    findOneBy: jest.fn(async (w: any) => { const r = rows.find((x) => match(x, w)); return r ? { ...r } : null; }),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = { ...x }; else rows.push({ ...x }); return x; }),
    delete: jest.fn(async (w: any) => { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], w)) rows.splice(i, 1); }),
  } as any;
}
const sara = { id: 'U-1', name: 'Sara' };
const kai = { id: 'U-2', name: 'Kai' };
const admin = { id: 'U-9', name: 'Edward', roleKey: 'admin' };

describe('checklist templates', () => {
  it('keeps clean items, and only the maker or an admin can change or delete one', async () => {
    const t = table();
    const s = new ChecklistTemplatesService(t);
    const tpl = await s.save({ name: 'Pre-pour', items: ['Rebar tied', { item: ' Forms braced ' }, '', null] }, sara);
    expect(tpl.items).toEqual([{ item: 'Rebar tied' }, { item: 'Forms braced' }]);
    await expect(s.save({ name: 'pre-pour', items: ['x'] }, kai)).rejects.toThrow(/already a checklist/);
    await expect(s.update(tpl.id, { items: ['x'] }, kai)).rejects.toThrow(/Only Sara/);
    await expect(s.remove(tpl.id, kai)).rejects.toThrow(/Only Sara/);
    expect((await s.update(tpl.id, { items: ['Rebar tied', 'Inspector signed'] }, admin)).items).toHaveLength(2);
    await s.remove(tpl.id, sara);
    expect(t.rows).toHaveLength(0);
  });

  it('needs a name and at least one item', async () => {
    const s = new ChecklistTemplatesService(table());
    await expect(s.save({ name: '', items: ['a'] }, sara)).rejects.toThrow(/Name/);
    await expect(s.save({ name: 'A', items: [' '] }, sara)).rejects.toThrow(/at least one/);
  });
});
