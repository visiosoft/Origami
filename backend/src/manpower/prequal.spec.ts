import { readFileSync } from 'fs';
import { join } from 'path';
import { cleanPrequal, prequalBlock } from './prequal';
import { PrequalService } from './prequal.service';

const good = { prequalStatus: 'approved', licenseNumber: 'C-10 123', licenseExpiry: '2027-01-01', insuranceProvider: 'Acme', insuranceExpiry: '2027-03-01' };

describe('GC / sub prequalification (Nov 13)', () => {
  it('only approved companies with a current licence and insurance can be invited to bid', () => {
    expect(prequalBlock(good, '2026-11-13')).toBeNull();
    expect(prequalBlock({ ...good, prequalStatus: null }, '2026-11-13')).toBe('Not prequalified yet');
    expect(prequalBlock({ ...good, prequalStatus: 'pending' }, '2026-11-13')).toBe('Prequalification waiting for review');
    expect(prequalBlock({ ...good, prequalStatus: 'rejected' }, '2026-11-13')).toBe('Prequalification was turned down');
    expect(prequalBlock({ ...good, licenseExpiry: '2026-11-12' }, '2026-11-13')).toBe('Licence expired Nov 12, 2026');
    expect(prequalBlock({ ...good, insuranceProvider: '' }, '2026-11-13')).toBe('No insurance on file');
    expect(prequalBlock({ ...good, insuranceExpiry: '2026-10-01' }, '2026-11-13')).toBe('Insurance expired Oct 1, 2026');
  });

  it('the browser copy of the rule is the same', () => {
    const body = (f: string) => readFileSync(f, 'utf8').match(/export function prequalBlock[\s\S]*?\n}\n/)![0];
    expect(body(join(__dirname, '../../../frontend/src/data/prequal.ts'))).toBe(body(join(__dirname, 'prequal.ts')));
  });

  it('the form: dates checked, answers kept', () => {
    expect(() => cleanPrequal({ licenseExpiry: 'next year' })).toThrow(/Licence expiry/);
    const r = cleanPrequal({ licenseNumber: ' C-10 123 ', licenseExpiry: '2027-01-01', trades: 'Tile', yearsInBusiness: '12', references: 'Smith job', w9OnFile: true });
    expect(r.fields).toEqual({ licenseNumber: 'C-10 123', licenseExpiry: '2027-01-01' });
    expect(r.answers).toMatchObject({ trades: 'Tile', yearsInBusiness: 12, references: 'Smith job', w9OnFile: true });
  });

  function svc(c: any) {
    const repo = { findOneBy: async () => c, save: async (x: any) => x, update: async (_: any, p: any) => Object.assign(c, p), find: async () => [c] };
    const settings = { jwtSecret: async () => 'secret', baseUrl: async () => 'https://app.test' };
    return new PrequalService(repo as any, { addAttachments: async () => c } as any, settings as any, { isConnected: async () => false } as any);
  }

  it('staff fill in the form, then approve -- not before licence and insurance are on file', async () => {
    const c: any = { id: 'K1', companyName: 'Tile Co', status: 'active' };
    const s = svc(c);
    await s.save('K1', { licenseNumber: 'C-10', licenseExpiry: '2099-01-01' }, 'Edward');
    expect(c.prequalStatus).toBe('pending');
    await expect(s.decide('K1', 'approved', '', 'Edward')).rejects.toThrow(/no insurance on file/);
    await s.save('K1', { insuranceProvider: 'Acme', insuranceExpiry: '2099-01-01' }, 'Edward');
    const v = await s.decide('K1', 'approved', 'Good references', 'Edward');
    expect(v).toMatchObject({ prequalStatus: 'approved', canBid: true, prequalBy: 'Edward' });
  });

  it('the sub fills it in from a private link; after a no, it goes back for review', async () => {
    const c: any = { id: 'K2', companyName: 'Stone Inc', status: 'active', email: 's@x.test', prequalStatus: 'rejected' };
    const s = svc(c);
    const { link, emailed } = await s.sendLink('K2', 'Edward');
    expect(emailed).toBe(false);
    const token = decodeURIComponent(link.split('token=')[1]);
    const out = await s.publicSubmit(token, { licenseNumber: 'L-1', licenseExpiry: '2099-01-01', trades: 'Stone' });
    expect(out).toMatchObject({ companyName: 'Stone Inc', licenseNumber: 'L-1', status: 'pending' });
    await expect(s.publicView('bad.token')).rejects.toThrow(/expired/);
  });
});
