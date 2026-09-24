import { CsiCodesService, companyRows } from './csi-codes.service';
import { COMPANY_COST_CODES } from '../seed-data/company-cost-codes';

function table(rows: any[] = []) {
  return {
    rows,
    find: jest.fn(async () => rows),
    count: jest.fn(async () => rows.length),
    save: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows[i] = it; else rows.push(it); } return x; }),
  } as any;
}
const store = () => { const m = new Map<string, string>(); return { get: jest.fn(async (k: string) => m.get(k) ?? null), set: jest.fn(async (k: string, v: string) => { m.set(k, v); }) }; };

describe('company cost codes', () => {
  it('every code gets its own id, divisions keep the MasterFormat ids', () => {
    const rows = companyRows();
    expect(rows).toHaveLength(COMPANY_COST_CODES.length);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length); // 09.20 and 10.28 appear twice
    expect(rows.find((r) => r.code === '03')).toMatchObject({ id: 'CSI-03', division: 'Foundation Concrete' });
    expect(rows.find((r) => r.code === '01.41')).toMatchObject({ id: 'CSI-01_41', division: 'Municipal Review & Fees' });
    expect(rows.filter((r) => r.code === '09.20').map((r) => r.id)).toEqual(['CSI-09_20', 'CSI-09_20-2']);
  });

  it('replaces the generic divisions in place, adds the sub-codes, keeps your own codes, once', async () => {
    const t = table([
      { id: 'CSI-03', code: '03 00 00', division: 'Concrete', description: '', active: true, order: 2 },
      { id: 'CSI-26', code: '26 00 00', division: 'Electrical', description: 'Our note', active: false, order: 17 },
      { id: 'CSI-1700000000', code: '99 01', division: 'Warranty callbacks', description: '', active: true, order: 23 },
    ]);
    const svc = new CsiCodesService(t, store() as any);
    await svc.adoptCompanyList();
    const by = (id: string) => t.rows.find((r: any) => r.id === id);
    expect(by('CSI-03')).toMatchObject({ code: '03', division: 'Foundation Concrete' });
    expect(by('CSI-26')).toMatchObject({ code: '26', division: 'Electrical', description: 'Our note', active: false });
    expect(by('CSI-1700000000')).toMatchObject({ division: 'Warranty callbacks', order: COMPANY_COST_CODES.length });
    expect(t.rows).toHaveLength(COMPANY_COST_CODES.length + 1);
    await svc.adoptCompanyList();
    expect(t.save).toHaveBeenCalledTimes(1);
  });
});
