import { PeopleService, PROJECT_PHASES } from './people.service';

describe('phases per project on a person', () => {
  const make = (row: any) => {
    const repo: any = { findOneBy: jest.fn(async () => row), save: jest.fn(async (x: any) => x) };
    const svc = Object.create(PeopleService.prototype) as PeopleService;
    Object.assign(svc, { repo });
    return svc;
  };
  it('keeps the phases for one project, in order, and clears them when none are left', async () => {
    expect(PROJECT_PHASES).toEqual(['crm', 'design', 'precon', 'construction']);
    const row: any = { id: 1, projects: ['HOM Cafe'], projectPhases: { Other: ['crm'] } };
    const svc = make(row);
    const saved: any = await svc.setProjectPhases('1', 'HOM Cafe', ['construction', 'design']);
    expect(saved.projectPhases).toEqual({ Other: ['crm'], 'HOM Cafe': ['design', 'construction'] });
    const cleared: any = await svc.setProjectPhases('1', 'Other', []);
    expect(cleared.projectPhases).toEqual({ 'HOM Cafe': ['design', 'construction'] });
    await expect(svc.setProjectPhases('1', 'HOM Cafe', ['framing'])).rejects.toThrow(/Unknown phase/);
  });
});
