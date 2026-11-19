import { stageRoleKey } from './stage-role';

describe('lead stage tasks go to the stage owner role (Nov 19)', () => {
  it('PC stages → Project Coordinator, PM stages → Project Manager', () => {
    expect(stageRoleKey(['section:New Lead'])).toBe('projectCoordinator');
    expect(stageRoleKey(['urgent', 'section:Project Fit Review'])).toBe('projectManager');
    expect(stageRoleKey(['section:Client Review'])).toBe('projectManager');
    expect(stageRoleKey(['urgent'])).toBeNull();
    expect(stageRoleKey(['section:Somewhere else'])).toBeNull();
  });
});
