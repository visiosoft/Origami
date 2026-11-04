import { EstimateEntity, EstimateGrLineEntity, EstimateLineEntity, EstimateScopeEntity } from '../database/entities';
import { cleanColumns, EstimatesService } from './estimates.service';

/** A tiny in-memory TypeORM stand-in: equality filters, In([...]) and order by one key. */
type Row = Record<string, any>;
const matches = (r: Row, where: Row = {}) => Object.entries(where).every(([k, v]) => (v && typeof v === 'object' && '_value' in v ? (v as any)._value.includes(r[k]) : r[k] === v));
function store() {
  const tables = new Map<any, Row[]>();
  const t = (E: any) => { if (!tables.has(E)) tables.set(E, []); return tables.get(E)!; };
  const repoFor = (E: any) => ({
    create: (x: Row) => Object.assign(new E(), x),
    find: async (o: any = {}) => {
      let rows = t(E).filter((r) => matches(r, o.where)).map((r) => ({ ...r }));
      const [key, dir] = Object.entries(o.order || {})[0] || [];
      if (key) rows = rows.sort((a, b) => (a[key] > b[key] ? 1 : -1) * (dir === 'DESC' ? -1 : 1));
      return rows.map((r) => Object.assign(new E(), r));
    },
    findOne: async (o: any) => { const r = t(E).find((x) => matches(x, o.where)); return r ? Object.assign(new E(), r) : null; },
    save: async (x: Row | Row[]) => {
      for (const r of Array.isArray(x) ? x : [x]) {
        const rows = t(E); const i = rows.findIndex((y) => y.id === r.id);
        if (E === EstimateEntity) r.version = (i >= 0 ? rows[i].version : 0) + 1;
        if (i >= 0) rows[i] = { ...r }; else rows.push({ ...r });
      }
      return x;
    },
  });
  const manager = {
    save: async (x: any) => { const E = (Array.isArray(x) ? x[0] : x)?.constructor; if (E && E !== Object) await repoFor(E).save(x); return x; },
    delete: async (E: any, where: Row) => { tables.set(E, t(E).filter((r) => !matches(r, where))); },
    find: async (E: any, o: any) => repoFor(E).find(o),
    count: async (E: any, o: any) => t(E).filter((r) => matches(r, o.where)).length,
    getRepository: () => ({ create: (x: Row) => x, save: async (x: Row) => x }),
  };
  return { repoFor, t, db: { transaction: async (fn: any) => fn(manager) } };
}

function setup(perms: any = 'all') {
  const s = store();
  const projects = { findOne: async () => ({ id: 7, name: 'Catherine bathrooms' }) };
  const log: string[] = [];
  const fin: any = { log: async (_m: any, e: any) => { log.push(e.action); } };
  const access: any = { permissionsOf: async () => perms };
  const svc = new EstimatesService(s.repoFor(EstimateEntity) as any, s.repoFor(EstimateScopeEntity) as any, s.repoFor(EstimateLineEntity) as any, s.repoFor(EstimateGrLineEntity) as any, projects as any, fin, access, s.db as any);
  return { svc, s, log };
}
const actor = { name: 'Edward', id: 'u1' };

const sheet = (version: number) => ({
  version,
  scopes: [{ id: 'scope-a', title: 'Primary bathroom', csiCodeId: 'csi-99' }],
  lines: [
    { id: 'line-1', scopeId: 'scope-a', kind: 'item', description: 'Demolish', cost: 2000, markupAmt: 640, strategy: 'subcontract', subName: 'Ricardo kitchen and bath' },
    { id: 'line-2', scopeId: 'scope-a', kind: 'item', description: 'Relocate drain', cost: 1040, markupAmt: 6801, pricing: 'nis', strategy: 'not_in_scope' },
    { id: 'line-3', scopeId: 'scope-a', kind: 'inclusion', description: 'Includes all labor', cost: 500 },
  ],
  gr: [{ id: 'gr-1', title: 'Construction Supervision', base: 750, qty: 3, unit: 'Monthly' }, { id: 'gr-2', title: 'Utility Usage', base: 10, qty: 3, included: false }],
});

describe('estimates', () => {
  it('a new estimate gets the next number and the standard GR lines', async () => {
    const { svc } = setup();
    const a = await svc.create(7, {}, actor);
    const b = await svc.create(7, { title: 'Option B' }, actor);
    expect([a.estimate.number, b.estimate.number]).toEqual(['EST-001', 'EST-002']);
    expect(a.gr.map((g: any) => g.title)).toContain('Construction Supervision');
    expect(a.estimate.status).toBe('draft');
  });

  it('saves the whole sheet and returns live totals; note rows carry no money', async () => {
    const { svc } = setup();
    const e = await svc.create(7, {}, actor);
    const out = await svc.saveSheet(7, e.estimate.id, sheet(e.estimate.version), actor);
    expect(out.lines.map((l: any) => l.id)).toEqual(['line-1', 'line-2', 'line-3']);
    expect(out.lines[2].cost).toBe(0);
    expect(out.result.totals.subtotal).toBe(264000);
    expect(out.result.totals.grTotal).toBe(225000);
    // (2,640 + 2,250) / 0.83
    expect(out.result.totals.totalBuild).toBe(589157);
  });

  it('rows left out are deleted, and a stale version is refused', async () => {
    const { svc } = setup();
    const e = await svc.create(7, {}, actor);
    const first = await svc.saveSheet(7, e.estimate.id, sheet(e.estimate.version), actor);
    const smaller = { ...sheet(first.estimate.version), lines: [sheet(0).lines[0]] };
    const out = await svc.saveSheet(7, e.estimate.id, smaller, actor);
    expect(out.lines).toHaveLength(1);
    await expect(svc.saveSheet(7, e.estimate.id, sheet(first.estimate.version), actor)).rejects.toThrow(/changed by Edward/);
  });

  it('rejects bad input: unknown pricing, a line outside the scopes, negative cost', async () => {
    const { svc } = setup();
    const e = await svc.create(7, {}, actor);
    const v = e.estimate.version;
    await expect(svc.saveSheet(7, e.estimate.id, { ...sheet(v), lines: [{ id: 'line-9', scopeId: 'scope-a', pricing: 'cheap' }] }, actor)).rejects.toThrow(/pricing type/);
    await expect(svc.saveSheet(7, e.estimate.id, { ...sheet(v), lines: [{ id: 'line-9', scopeId: 'elsewhere' }] }, actor)).rejects.toThrow(/belong to a scope/);
    await expect(svc.saveSheet(7, e.estimate.id, { ...sheet(v), lines: [{ id: 'line-9', scopeId: 'scope-a', cost: -5 }] }, actor)).rejects.toThrow(/positive/);
  });

  it('settings: percentages, discount, design cost and payment rows feed the totals', async () => {
    const { svc } = setup();
    const e = await svc.create(7, {}, actor);
    const s1 = await svc.saveSheet(7, e.estimate.id, sheet(e.estimate.version), actor);
    const out = await svc.saveSettings(7, e.estimate.id, { version: s1.estimate.version, discount: 100, designCost: 1000, payments: [{ label: 'Deposit', mode: 'pct', value: 10 }] }, actor);
    expect(out.result.totals.totalProject).toBe(589157 - 10000 + 100000);
    expect(out.result.payments[0].amount).toBe(67916);
    await expect(svc.saveSettings(7, e.estimate.id, { version: out.estimate.version, profitPct: 'lots' }, actor)).rejects.toThrow(/percentage/);
  });

  it('sending freezes it; a revision copies everything as Rev 2 and supersedes Rev 1 when sent', async () => {
    const { svc, log } = setup();
    const e = await svc.create(7, {}, actor);
    await svc.saveSheet(7, e.estimate.id, sheet(e.estimate.version), actor);
    const sent = await svc.markSent(7, e.estimate.id, actor);
    expect(sent.locked).toBe(true);
    await expect(svc.saveSheet(7, e.estimate.id, sheet(sent.estimate.version), actor)).rejects.toThrow(/frozen/);
    await expect(svc.remove(7, e.estimate.id, actor)).rejects.toThrow(/Only a draft/);
    const r2 = await svc.revise(7, e.estimate.id, actor);
    expect(r2.estimate).toMatchObject({ number: 'EST-001', rev: 2, status: 'draft', revisionOf: e.estimate.id });
    expect(r2.lines).toHaveLength(3);
    expect(r2.lines.every((l: any) => r2.scopes.some((s: any) => s.id === l.scopeId))).toBe(true);
    expect(r2.result.totals.totalBuild).toBe(589157);
    await expect(svc.revise(7, e.estimate.id, actor)).rejects.toThrow(/already has a draft/);
    await svc.markSent(7, r2.estimate.id, actor);
    expect((await svc.get(7, e.estimate.id, actor)).estimate.status).toBe('superseded');
    expect(log).toEqual(['created', 'sent', 'revised', 'sent']);
  });

  it('an estimate from another project is not found', async () => {
    const { svc } = setup();
    const e = await svc.create(7, {}, actor);
    await expect(svc.get(8, e.estimate.id, actor)).rejects.toThrow(/not found/);
  });

  it('view-only roles can read but not edit; others are refused', async () => {
    const viewer = setup({ estimating: { view: true } });
    await expect(viewer.svc.create(7, {}, actor)).rejects.toThrow(/doesn't allow editing/);
    expect((await viewer.svc.list(7, actor)).rights).toEqual({ view: true, edit: false });
    const none = setup({ tasks: { view: true } });
    await expect(none.svc.list(7, actor)).rejects.toThrow(/doesn't include estimates/);
  });

  it('custom columns: unique keys, known types, formulas kept as text, internal-only by default', () => {
    const cols = cleanColumns([{ key: 'waste', label: 'Waste %', type: 'pct' }, { key: 'adj', type: 'formula', formula: '=[cost]*1.1' }]);
    expect(cols[1]).toMatchObject({ formula: '=[cost]*1.1', showClient: false, showSub: false, table: 'lines' });
    expect(() => cleanColumns([{ key: 'a', type: 'text' }, { key: 'a', type: 'text' }])).toThrow(/unique/);
    expect(() => cleanColumns([{ key: 'a', type: 'script' }])).toThrow(/Unknown column type/);
  });
});
