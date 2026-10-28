import { cleanFormer, formerFromExpired } from './connections';

describe('connections', () => {
  it('cleans the list', () => {
    expect(cleanFormer([{ company: ' Lono Builders ', role: 'PM', personId: '4', until: '2025' }, { company: 'lono builders' }, { company: '' }, 'x'])).toEqual([
      { company: 'Lono Builders', personId: 4, role: 'PM', until: '2025' },
    ]);
    expect(cleanFormer(null)).toEqual([]);
  });
  it('an expired record at another company becomes a former company', () => {
    expect(formerFromExpired({ company: 'Kestrel Electric' }, { id: 1, company: 'Lono Builders', role: 'Estimator', contactStatus: 'expired', contactStatusAt: '2025-06-01T00:00:00Z' }))
      .toEqual([{ company: 'Lono Builders', personId: 1, role: 'Estimator', until: '2025-06' }]);
    expect(formerFromExpired({ company: 'Lono Builders' }, { id: 1, company: 'Lono Builders', contactStatus: 'expired' })).toEqual([]);
    expect(formerFromExpired({ company: 'Kestrel' }, { id: 1, company: 'Lono', contactStatus: 'active' })).toEqual([]);
  });
});
