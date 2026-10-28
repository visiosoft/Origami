import { describe, expect, it } from 'vitest';
import { inviteGuests, siteVisitDescription, zoningSections } from './siteVisitInvite';

const team = [
  { name: 'Edward', email: 'edward@origamidb.com', optional: false },
  { name: 'Astrid', email: 'astrid@origamidb.com', optional: true },
];

describe('site visit invite', () => {
  it('puts the client first and lists everyone once', () => {
    const g = inviteGuests([...team, { name: 'Ed again', email: 'EDWARD@origamidb.com', optional: true }], { name: 'Jo', email: 'jo@x.com' });
    expect(g.map((x) => [x.email, x.optional])).toEqual([['jo@x.com', false], ['edward@origamidb.com', false], ['astrid@origamidb.com', true]]);
    expect(inviteGuests(team, { email: 'not an email' })).toHaveLength(2);
  });

  it('keeps only the zoning fields that were filled in', () => {
    const form = [
      { title: 'Jurisdiction', fields: [{ key: 'county', label: 'County' }, { key: 'city', label: 'City' }] },
      { title: 'Setbacks', fields: [{ heading: true, label: 'Setbacks' }, { key: 'front', label: 'Front' }] },
    ];
    expect(zoningSections(form, { county: 'Honolulu', city: 'N/A', front: '' })).toEqual([{ title: 'Jurisdiction', rows: [['County', 'Honolulu']] }]);
  });

  it('describes the scope, skipping N/A, and adds zoning only when given', () => {
    const lead = { potentialProjectType: 'Addition', propertyType: 'N/A', projectVision: 'Second storey', budgetPosition: '$400k' };
    const d = siteVisitDescription({ lead, leadName: 'Narvaes', address: '91-1062 Kuhina St', notes: 'Gate code 1234', link: 'https://app/pipeline?lead=1' });
    expect(d).toContain('• Project type: Addition');
    expect(d).not.toContain('Property type');
    expect(d).toContain('PRELIMINARY INFO\nGate code 1234');
    expect(d).not.toContain('ZONING');
    const z = siteVisitDescription({ lead, leadName: 'Narvaes', zoning: [{ title: 'Zoning Analysis', rows: [['Zoning District', 'R-5']] }] });
    expect(z).toContain('ZONING ANALYSIS\nZoning Analysis:\n• Zoning District: R-5');
  });
});
