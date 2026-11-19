import { programmeSourceKey } from './programme-source';

describe('programme task source (Nov 19)', () => {
  const roles = { architect: 'U-A', projectManager: 'U-P' };
  it('design work comes from the Architect, construction from the Project / Construction Manager', () => {
    expect(programmeSourceKey({ key: 'schematic_design', name: 'Schematic Design' }, roles)).toBe('architect');
    expect(programmeSourceKey({ key: 'framing', name: 'Framing' }, roles)).toBe('projectManager');
    expect(programmeSourceKey({ name: 'Framing' }, { architect: 'U-A' })).toBe('architect');
    expect(programmeSourceKey({ name: 'Framing' }, {})).toBeNull();
  });
});
