import { EstimateStatementsService, SEED_STATEMENTS } from './estimate-statements.service';

type Row = Record<string, any>;
const isIn = (v: any) => v && typeof v === 'object' && '_value' in v;
const match = (r: Row, w: Row = {}) => Object.entries(w).every(([k, v]) => (isIn(v) ? v._value.includes(r[k]) : r[k] === v));
const repo = (rows: Row[]) => ({
  create: (x: Row) => ({ ...x }),
  find: async (o: any = {}) => rows.filter((r) => match(r, o.where)),
  findOne: async (o: any) => rows.find((r) => match(r, o.where)) || null,
  count: async () => rows.length,
  save: async (x: Row | Row[]) => { for (const r of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((y) => y.id === r.id); if (i >= 0) rows[i] = r; else rows.push(r); } return x; },
  delete: async (w: Row) => { const keep = rows.filter((r) => !match(r, w)); rows.length = 0; rows.push(...keep); },
});

function setup(rights = { view: true, edit: true }, seeded: string | null = null) {
  const lib: Row[] = [];
  const scopes = [{ id: 's1', csiCodeId: 'csi-tile' }, { id: 's2', csiCodeId: 'csi-tile' }, { id: 's3', csiCodeId: 'csi-demo' }];
  const lines = [
    { id: 'a', scopeId: 's1', kind: 'exclusion', description: 'Excludes shower doors.' },
    { id: 'b', scopeId: 's2', kind: 'exclusion', description: 'Excludes  shower doors. ' },
    { id: 'c', scopeId: 's2', kind: 'exclusion', description: 'No heated floors.' },
    { id: 'd', scopeId: 's2', kind: 'item', description: 'Install tile' },
    { id: 'e', scopeId: 's3', kind: 'exclusion', description: 'Demo only' },
    { id: 'f', scopeId: 's1', kind: 'inclusion', description: 'Grout sealer' },
  ];
  const settings: Row = { v: seeded };
  const svc = new EstimateStatementsService(repo(lib) as any, repo(scopes) as any, repo(lines) as any, repo([{ id: 'csi-01', code: '01' }]) as any,
    { rights: async () => rights } as any, { get: async () => settings.v, set: async (_k: string, v: string) => { settings.v = v; } } as any);
  return { svc, lib, settings };
}
const actor = { name: 'Edward' };

describe('standard statements', () => {
  it('seeds the sheet’s reusable wording once, on the right CSI code', async () => {
    const { svc, lib, settings } = setup();
    await svc.onApplicationBootstrap();
    expect(lib.map((s) => [s.csiCodeId, s.kind])).toEqual([[null, 'assumption'], ['csi-01', 'inclusion']]);
    expect(lib).toHaveLength(SEED_STATEMENTS.length);
    expect(settings.v).toBe('1');
    lib.length = 0;
    await svc.onApplicationBootstrap();
    expect(lib).toHaveLength(0);
  });

  it('a scope sees its CSI code’s statements and the ones for every scope', async () => {
    const { svc } = setup();
    await svc.create({ kind: 'exclusion', text: 'No permits.', csiCodeId: null }, actor);
    await svc.create({ kind: 'exclusion', text: 'Excludes shower doors.', csiCodeId: 'csi-tile' }, actor);
    await svc.create({ kind: 'details', text: 'Demo to studs.', csiCodeId: 'csi-demo' }, actor);
    expect((await svc.list(actor, 'csi-tile')).rows.map((r) => r.text)).toEqual(['No permits.', 'Excludes shower doors.']);
    expect((await svc.list(actor)).rows).toHaveLength(3);
  });

  it('suggests wording used before on the same CSI code, most used first, skipping what the library has', async () => {
    const { svc } = setup();
    expect((await svc.suggestions(actor, 'csi-tile', 'exclusion')).rows).toEqual([
      { text: 'Excludes shower doors.', kind: 'exclusion', uses: 2 },
      { text: 'No heated floors.', kind: 'exclusion', uses: 1 },
    ]);
    await svc.create({ kind: 'exclusion', text: 'Excludes shower doors.', csiCodeId: 'csi-tile' }, actor);
    expect((await svc.suggestions(actor, 'csi-tile', 'exclusion')).rows.map((r) => r.text)).toEqual(['No heated floors.']);
    expect((await svc.suggestions(actor, null, 'exclusion')).rows).toEqual([]);
  });

  it('checks input, ignores duplicates, edits and deletes; view-only roles can’t change it', async () => {
    const { svc, lib } = setup();
    await expect(svc.create({ kind: 'note', text: 'x' }, actor)).rejects.toThrow(/Choose Details/);
    await expect(svc.create({ kind: 'details', text: '  ' }, actor)).rejects.toThrow(/empty/);
    const a = await svc.create({ kind: 'details', text: 'Layout to remain.' }, actor);
    await svc.create({ kind: 'details', text: 'layout  to remain.' }, actor);
    expect(lib).toHaveLength(1);
    await svc.update(a.id, { text: 'Layout and fixtures to remain.' }, actor);
    expect(lib[0]).toMatchObject({ text: 'Layout and fixtures to remain.', kind: 'details', updatedBy: 'Edward' });
    await svc.remove(a.id, actor);
    expect(lib).toHaveLength(0);
    const viewer = setup({ view: true, edit: false }).svc;
    await expect(viewer.create({ kind: 'details', text: 'x' }, actor)).rejects.toThrow(/doesn't allow/);
  });
});
