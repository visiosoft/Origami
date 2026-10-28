import { cleanAutoFor, matchesAuto, withAutoChecklists } from './auto-checklist';

describe('auto checklists', () => {
  const tpls = [
    { id: 'A', items: [{ item: 'Photo before' }, { item: 'Photo after' }], autoFor: ['task'] },
    { id: 'B', items: [{ item: 'Hazard noted' }], autoFor: ['record:Observation'] },
    { id: 'C', items: [{ item: 'PPE check' }, { item: 'photo before' }], autoFor: ['label:Safety'] },
    { id: 'D', items: [{ item: 'Never' }], autoFor: null },
  ];
  it('cleans targets', () => {
    expect(cleanAutoFor(['task', 'task', 'record:Observation', 'label: ', 'bogus', 'label:Safety'])).toEqual(['task', 'record:Observation', 'label:Safety']);
  });
  it('matches by kind, record type and label', () => {
    expect(matchesAuto(['record'], { kind: 'record', type: 'FYI' })).toBe(true);
    expect(matchesAuto(['record:Observation'], { kind: 'record', type: 'FYI' })).toBe(false);
    expect(matchesAuto(['label:safety'], { kind: 'task', labels: ['Safety'] })).toBe(true);
  });
  it('adds matching items once, unticked', () => {
    const out = withAutoChecklists(tpls, { kind: 'task', labels: ['Safety'] }, [{ id: 'x', item: 'PPE check', done: true }], 's');
    expect(out.map((c) => c.item)).toEqual(['PPE check', 'Photo before', 'Photo after']);
    expect(out.slice(1).every((c) => !c.done)).toBe(true);
    expect(withAutoChecklists(tpls, { kind: 'record', type: 'Observation' }, []).map((c) => c.item)).toEqual(['Hazard noted']);
  });
});
