import { personOnProject, personProjectIds, projectIdPlan, projectsToStore, renamedPeople } from './person-projects';
import { PeopleService } from './people.service';
import { ProjectsService } from '../projects/projects.service';

const projects = [{ id: 1, name: 'Catherine bathrooms' }, { id: 2, name: 'Smith  Kitchen' }, { id: 3, name: 'Lee ADU' }];

describe('people linked to projects by id (Nov 13)', () => {
  it('ids once set; before that, names matched ignoring case and spacing', () => {
    expect(personProjectIds({ projects: ['catherine BATHROOMS', 'smith kitchen', 'Gone'] }, projects)).toEqual([1, 2]);
    expect(personProjectIds({ projects: ['Old name'], projectIds: [3] }, projects)).toEqual([3]);
    expect(personProjectIds({ projects: ['Catherine bathrooms'], projectIds: [] }, projects)).toEqual([]);
    expect(personOnProject({ projectIds: [2] }, projects[1], projects)).toBe(true);
  });

  it('saving: ids are the record and the names follow; names alone are matched, unknown names kept without access', () => {
    expect(projectsToStore({ projectIds: [3, 1, 99] }, projects)).toEqual({ projectIds: [3, 1], projects: ['Lee ADU', 'Catherine bathrooms'] });
    expect(projectsToStore({ projects: ['lee adu', 'Somewhere'] }, projects)).toEqual({ projectIds: [3], projects: ['Lee ADU', 'Somewhere'] });
  });

  it('the move to ids lists what each name becomes and which match nothing', () => {
    const plan = projectIdPlan([
      { id: 10, name: 'Kai', projects: ['Catherine bathrooms', 'Typo job'] },
      { id: 11, name: 'Done', projects: ['Lee ADU'], projectIds: [3] },
      { id: 12, name: 'None', projects: [] },
    ], projects);
    expect(plan).toEqual([{ id: 10, name: 'Kai', projects: [{ id: 1, name: 'Catherine bathrooms' }], unmatched: ['Typo job'] }]);
  });

  it('apply writes ids (and keeps unmatched names for fixing) only when confirmed', async () => {
    const rows: any[] = [{ id: 10, name: 'Kai', projects: ['catherine bathrooms', 'Typo job'] }];
    const repo = { find: async () => rows.map((r) => ({ ...r })), update: async (w: any, patch: any) => Object.assign(rows.find((r) => r.id === w.id), patch) };
    const svc = new PeopleService(repo as any, undefined, undefined, undefined, undefined, undefined, { find: async () => projects } as any);
    expect((await svc.applyProjectIds(false)).applied).toBe(false);
    expect(rows[0].projectIds).toBeUndefined();
    expect(await svc.applyProjectIds(true)).toEqual({ applied: true, changed: 1 });
    expect(rows[0]).toMatchObject({ projectIds: [1], projects: ['Catherine bathrooms', 'Typo job'] });
  });

  it('renaming a project keeps everyone on it, with the new name', () => {
    const people = [
      { id: 1, projects: ['Catherine bathrooms'], projectIds: [1], projectPhases: { 'Catherine bathrooms': ['design'] } },
      { id: 2, projects: ['Catherine bathrooms'] },
      { id: 3, projects: ['Lee ADU'], projectIds: [3] },
    ];
    const out = renamedPeople(people, 1, 'Catherine bathrooms', 'Catherine — two baths');
    expect(out.map((p) => [p.id, p.projects])).toEqual([[1, ['Catherine — two baths']], [2, ['Catherine — two baths']]]);
    expect(out[0].projectPhases).toEqual({ 'Catherine — two baths': ['design'] });
  });

  it('ProjectsService.update renames the project on people too', async () => {
    const projectRows: any[] = [{ id: 1, name: 'Catherine bathrooms' }];
    const people: any[] = [{ id: 5, projects: ['Catherine bathrooms'], projectIds: [1] }];
    const repo = { findOneBy: async (w: any) => ({ ...projectRows.find((p) => p.id === w.id) }), update: async (w: any, patch: any) => Object.assign(projectRows.find((p) => p.id === w.id), patch), find: async () => projectRows };
    const peopleRepo = { find: async () => people.map((p) => ({ ...p })), save: async (p: any) => Object.assign(people.find((x) => x.id === p.id), p) };
    const svc = new ProjectsService(repo as any, undefined, peopleRepo as any);
    (svc as any).findOne = async () => projectRows[0];
    await svc.update('1', { name: 'Catherine — two baths' });
    expect(people[0].projects).toEqual(['Catherine — two baths']);
  });
});
