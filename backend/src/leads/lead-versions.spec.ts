import { leadChanges } from './lead-versions';
import { LeadsService } from './leads.service';

describe('lead versions (Full Details history)', () => {
  it('lists only the details that changed, ignoring the save stamp', () => {
    expect(leadChanges(
      { id: 'L', budgetPosition: 'Under $100k', city: 'San Jose', addresses: { a: 1 }, updatedAt: '1' },
      { id: 'L', budgetPosition: '$100k-$250k', city: 'San Jose', addresses: { a: 2 }, phone: '408', updatedAt: '2' },
    )).toEqual({
      budgetPosition: { from: 'Under $100k', to: '$100k-$250k' },
      addresses: { from: { a: 1 }, to: { a: 2 } },
      phone: { from: null, to: '408' },
    });
  });

  it('keeps one version per save that changed something, with who saved it', async () => {
    const row: any = { id: 'L', budgetPosition: 'A', updatedAt: 'x' };
    const repo: any = { findOneBy: jest.fn(async () => ({ ...row })), save: jest.fn(async (x: any) => x) };
    const versions: any = { create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => x) };
    const svc = new LeadsService(repo, { } as any, undefined, versions);
    await svc.update('L', { budgetPosition: 'B' }, 'Edward');
    expect(versions.save).toHaveBeenCalledWith(expect.objectContaining({ leadId: 'L', by: 'Edward', changes: { budgetPosition: { from: 'A', to: 'B' } } }));
    await svc.update('L', { budgetPosition: 'A' }, 'Edward');
    expect(versions.save).toHaveBeenCalledTimes(1);
  });
});
