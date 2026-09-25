import { phaseCategorizer, type ProgrammeTemplateDef } from './programme-template';

const ph = (key: string) => ({ key, name: key, color: '#000', tasks: [] }) as any;
const lib: ProgrammeTemplateDef[] = [
  { key: 'default', name: 'Default', category: 'design', phases: ['programming', 'schematic', 'dd', 'ca', 'gc', 'closeout'].map(ph) },
  { key: 'construction', name: 'Construction', category: 'construction', phases: ['kickoff', 'framing'].map(ph) },
  { key: 'interiors', name: 'Interiors', category: 'design', phases: ['kickoff', 'finishes'].map(ph) },
];

describe('phaseCategorizer', () => {
  it('keeps GC selection, CA and closeout on the construction side of a design-filed template', () => {
    const cat = phaseCategorizer(lib, null);
    expect(['programming', 'schematic', 'dd'].map(cat)).toEqual(['design', 'design', 'design']);
    expect(['ca', 'gc', 'closeout'].map(cat)).toEqual(['construction', 'construction', 'construction']);
  });

  it('a phase picked up from another template takes that template\'s category', () => {
    expect(phaseCategorizer(lib, 'default')('framing')).toBe('construction');
    expect(phaseCategorizer(lib, 'default')('finishes')).toBe('design');
    expect(phaseCategorizer(lib, 'default')('fin-abc123')).toBe('other');
  });

  it('a shared key follows the project\'s own template', () => {
    expect(phaseCategorizer(lib, 'interiors')('kickoff')).toBe('design');
    expect(phaseCategorizer(lib, 'construction')('kickoff')).toBe('construction');
  });
});
