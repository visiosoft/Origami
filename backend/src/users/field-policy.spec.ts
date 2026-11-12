import { fieldPolicy, isFieldRole } from './field-policy';

describe('field roles and money (Nov 10 sync)', () => {
  it('a superintendent loses estimates and cost figures, keeps their own entries, and only views People/Projects', () => {
    const { next, changes } = fieldPolicy({
      estimating: { view: true, manage: true }, 'fin:preconstruction_estimates': { view: true, manage: true }, 'fin:subcontractor_financials': { view: true, manage: true },
      'fin:reimbursables': { view: true, manage: true }, 'fin:timesheets': { view: true, manage: true },
      people: { view: true, manage: true }, projects: { view: true, manage: true }, tasks: { view: true, manage: true }, daily_reports: { view: true, manage: true },
    });
    expect(changes).toEqual([
      { key: 'estimating', from: 'view + change', to: 'off' },
      { key: 'fin:preconstruction_estimates', from: 'view + change', to: 'off' },
      { key: 'fin:subcontractor_financials', from: 'view + change', to: 'off' },
      { key: 'people', from: 'view + change', to: 'view' },
      { key: 'projects', from: 'view + change', to: 'view' },
    ]);
    expect(next['fin:reimbursables']).toEqual({ view: true, manage: true });
    expect(next.tasks).toEqual({ view: true, manage: true });
  });
  it('a role already in line changes nothing; field roles are found by key or name', () => {
    expect(fieldPolicy({ 'fin:reimbursables': { view: true, manage: true }, people: { view: true, manage: false } }).changes).toEqual([]);
    expect(isFieldRole({ key: 'r_internal_super' })).toBe(true);
    expect(isFieldRole({ key: 'role_123', name: 'Site Foreman' })).toBe(true);
    expect(isFieldRole({ key: 'r_internal_project_manager', name: 'Project Manager' })).toBe(false);
  });
});
