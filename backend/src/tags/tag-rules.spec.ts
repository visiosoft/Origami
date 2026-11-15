import { autoTags, cleanTagName, isPersonalTag, splitTags, tagsAfterLabelEdit } from './tag-rules';

describe('tag rules', () => {
  it('cleans names and splits standard from custom', () => {
    expect(cleanTagName('  #Punch   list ')).toBe('Punch list');
    expect(splitTags(['Internal', 'punch list', 'Punch List', '', 'CRM', 'Kitchen'])).toEqual({ standard: ['internal', 'crm'], custom: ['punch list', 'Kitchen'] });
  });
  it('knows a personal tag by a first or full name', () => {
    const people = ['Astrid Rivas', 'Ed Ciccarelli', 'Jo'];
    expect(isPersonalTag('Astrid private', people)).toBe(true);
    expect(isPersonalTag('astrid rivas follow up', people)).toBe(true);
    expect(isPersonalTag('Astridx', people)).toBe(false);
    expect(isPersonalTag('Jo list', people)).toBe(false); // names under 3 letters are too easy to hit
    expect(isPersonalTag('Kitchen', people)).toBe(false);
  });
  it('a new item is Internal by default, plus where it was made', () => {
    expect(autoTags({})).toEqual(['internal']);
    expect(autoTags({ fromLead: true })).toEqual(['internal', 'crm']);
    expect(autoTags({ projectStage: 'Construction' })).toEqual(['internal', 'construction']);
    expect(autoTags({ projectStage: 'Design' })).toEqual(['internal', 'design']);
  });
  it('picked Client or External, or made by / assigned to an outside account: not Internal', () => {
    expect(autoTags({ tags: ['client'] })).toEqual(['client']);
    expect(autoTags({ outsideCreator: true })).toEqual([]);
    expect(autoTags({ outsideAssignee: 'client' })).toEqual(['client']);
    expect(autoTags({ outsideAssignee: 'external', projectStage: 'Construction' })).toEqual(['external', 'construction']);
  });
  it('money is Financial (and Internal); a personal tag keeps it Internal', () => {
    expect(autoTags({ financial: true, tags: ['client'] })).toEqual(['internal', 'client', 'financial']);
    expect(autoTags({ tags: ['client'], labels: ['Astrid private'], people: ['Astrid Rivas'] })).toEqual(['internal', 'client']);
  });
  it('adding a personal tag later brings Internal; other edits leave the tags alone', () => {
    expect(tagsAfterLabelEdit(['client'], ['Kitchen'], ['Kitchen', 'Astrid private'], ['Astrid Rivas'])).toEqual(['internal', 'client']);
    expect(tagsAfterLabelEdit(['client'], ['Astrid private'], ['Astrid private', 'Kitchen'], ['Astrid Rivas'])).toEqual(['client']);
  });
});
