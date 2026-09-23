import { SubcontractorTradesService } from './subcontractor-trades.service';
import { DEFAULT_SUBCONTRACTOR_TRADES } from '../seed-data/subcontractor-trades';
import type { ManpowerAccess } from './manpower-access.service';

function table(rows: any[] = []) {
  const match = (r: any, where: any) => Object.entries(where || {}).every(([k, v]) => r[k] === v);
  return {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where))),
    count: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).length),
    findOneBy: jest.fn(async (w: any) => rows.find((r) => match(r, w)) ?? null),
    save: jest.fn(async (x: any) => x),
    remove: jest.fn(async (x: any) => x),
  } as any;
}

describe('SubcontractorTradesService', () => {
  const setup = () => {
    const t = {
      subs: table(DEFAULT_SUBCONTRACTOR_TRADES.map((x) => ({ ...x }))),
      contractors: table([{ id: 'CTR-1', companyName: 'Al-Noor', tradeIds: ['SCT-C-10'] }]),
      employees: table([
        { id: 'E1', name: 'Riaz', tradeId: 'TRD-01', trade: 'Mason' },          // Mason -> C-29 Masonry
        { id: 'E2', name: 'Bilal', tradeId: 'TRD-11', trade: 'Driver' },        // Driver: no licensed trade
        { id: 'E3', name: 'Zahid', tradeId: 'SCT-C-10', trade: 'Electrical' },  // already moved
        { id: 'E4', name: 'Custom', tradeId: 'TRD-99', trade: 'Rigger' },       // a trade someone added to the old list
      ]),
      assignments: table([{ id: 'A1', employeeId: 'E1', tradeId: 'TRD-01' }, { id: 'A2', employeeId: 'E2', tradeId: 'TRD-11' }]),
      requests: table([{ id: 'WR1', lines: [{ id: 'L1', tradeId: 'TRD-05', quantity: 2 }, { id: 'L2', tradeId: 'TRD-12', quantity: 3 }] }]),
      oldTrades: table([{ id: 'TRD-99', name: 'Rigger' }]),
    };
    const svc = new SubcontractorTradesService(t.subs, t.contractors, t.employees, t.assignments, t.requests, t.oldTrades, { require: jest.fn() } as unknown as ManpowerAccess);
    return { svc, t };
  };

  it('moves workers, assignments and request lines off the old worker-trade list, once', async () => {
    const { svc, t } = setup();
    await svc.migrateWorkerTrades();
    expect(t.employees.rows).toEqual([
      { id: 'E1', name: 'Riaz', tradeId: 'SCT-C-29', trade: 'Masonry' },
      { id: 'E2', name: 'Bilal', tradeId: null, trade: 'Driver' },
      { id: 'E3', name: 'Zahid', tradeId: 'SCT-C-10', trade: 'Electrical' },
      { id: 'E4', name: 'Custom', tradeId: null, trade: 'Rigger' },
    ]);
    expect(t.assignments.rows.map((a: any) => a.tradeId)).toEqual(['SCT-C-29', null]);
    expect(t.requests.rows[0].lines).toEqual([
      { id: 'L1', tradeId: 'SCT-C-60', quantity: 2, designation: 'Welder' },
      { id: 'L2', tradeId: '', quantity: 3, designation: 'Helper' },
    ]);
    t.employees.save.mockClear();
    await svc.migrateWorkerTrades();
    expect(t.employees.save).not.toHaveBeenCalled();
  });

  it("won't delete a trade that companies or workers use", async () => {
    const { svc, t } = setup();
    t.employees.rows.push({ id: 'E5', tradeId: 'SCT-C-29' });
    await expect(svc.remove('SCT-C-10', { name: 'HR' })).rejects.toThrow(/1 contractor/);
    await expect(svc.remove('SCT-C-29', { name: 'HR' })).rejects.toThrow(/1 worker/);
    await svc.remove('SCT-D-03', { name: 'HR' });
    expect(t.subs.remove).toHaveBeenCalled();
  });
});
