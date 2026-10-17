import { describe, expect, it } from 'vitest';
import { OVERALL_KEY, dataTypeLabel, flagsFor, levelOf, permFor, usesLevels } from './accessLevels';

describe('access levels', () => {
  it('works out view / manage and reads a data type through the overall access', () => {
    expect(flagsFor('block_permit')).toEqual({ view: false, manage: false });
    expect(flagsFor('dashboard')).toEqual({ view: true, manage: true });
    const p = { [OVERALL_KEY]: permFor('modify', 'assigned'), rfis: permFor('view') };
    expect(usesLevels(p)).toBe(true);
    expect(usesLevels({ rfis: { view: true, manage: false } })).toBe(false);
    expect(levelOf(p, 'rfis')).toEqual({ level: 'view', extent: 'assigned', own: true });
    expect(levelOf(p, 'tasks')).toEqual({ level: 'modify', extent: 'assigned', own: false });
  });
  it('names data types', () => {
    expect(dataTypeLabel('fin:gr_2.01_construction_supervision', [])).toBe('2.01 construction supervision');
    expect(dataTypeLabel('rfis', [{ key: 'rfis', label: 'RFI' }])).toBe('RFI');
    expect(dataTypeLabel(OVERALL_KEY, [])).toBe('Overall access');
  });
});
