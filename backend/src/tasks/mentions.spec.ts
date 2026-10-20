import { mentionedIds } from './mentions';

describe('@mentions in task comments', () => {
  const users = [{ id: 'U-A', name: 'Andrea Castillo' }, { id: 'U-E', name: 'Edward Ciccarelli' }, { id: 'U-E2', name: 'Edward Dummy' }, { id: 'U-G', name: 'George Finau' }];
  it('finds full names and unique first names', () => {
    expect(mentionedIds('@Andrea Castillo can you check the tile?', users)).toEqual(['U-A']);
    expect(mentionedIds('Thanks @george, and @andrea please confirm', users).sort()).toEqual(['U-A', 'U-G']);
  });
  it('a first name two people share needs the full name', () => {
    expect(mentionedIds('@Edward see above', users)).toEqual([]);
    expect(mentionedIds('@Edward Ciccarelli see above', users)).toEqual(['U-E']);
  });
  it('ignores emails and plain words', () => {
    expect(mentionedIds('send to andrea@origamidb.com', users)).toEqual([]);
    expect(mentionedIds('Andrea will do it', users)).toEqual([]);
  });
});
