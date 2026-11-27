import { trimToProjects } from './person-projects';

describe('Nov 27: address book by project shows only the viewer’s projects', () => {
  const projects = [{ id: 7, name: 'Countryside' }, { id: 8, name: 'HŌM Cafe' }, { id: 9, name: 'Smith kitchen' }];
  it('cuts a colleague’s projects to the ones the viewer is on (by id or by name)', () => {
    expect(trimToProjects({ projectIds: [7, 8, 9], projects: ['Countryside', 'HŌM Cafe', 'Smith kitchen'] } as any, new Set([8]), projects)).toMatchObject({ projectIds: [8], projects: ['HŌM Cafe'] });
    expect(trimToProjects({ projects: ['Countryside', 'Smith kitchen'] } as any, new Set([7, 8]), projects)).toMatchObject({ projectIds: [7], projects: ['Countryside'] });
    expect(trimToProjects({ projectIds: [9] } as any, new Set([7]), projects)).toMatchObject({ projectIds: [], projects: [] });
  });
});
