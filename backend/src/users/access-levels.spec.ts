import { OVERALL_KEY, effectivePermissions, extentOf, flagsFor, keyForRow, levelFrom, parseAccessMatrix, perm, rolePermissionsFrom } from './access-levels';

/** A two-role slice of the client's sheet. */
const SHEET: string[][] = [
  ['', 'RANK -------------------->', 'I - 2', '', '', 'C - 1', '', ''],
  ['', 'BUCKET----------------->', 'INTERNAL', '', '', 'CLIENT', '', ''],
  ['', 'CLASSIFICATION----->', 'STAFF', '', '', 'CLIENT', '', ''],
  ['SEE DEFINITION BELOW', 'Email/Account to Test', 'pm@x.com\nSecret123*', '', '', '', '', ''],
  ['', 'ROLE---------------------->', 'INTERNAL PROJECT MANAGER\n', '', '', 'CLIENT OPEN BOOK', '', ''],
  ['', 'DATA TYPE', 'ACCESS TYPE', 'Extent', 'Other Note', 'ACCESS TYPE', 'Extent', 'Other Note'],
  ['Note overall access…', 'OVERALL ACCESS', 'MODIFY', 'Assigned Projects', '', 'VIEW ONLY', 'Assigned Projects', ''],
  ['', 'MAIN', 'MODIFY', 'Assigned Projects', '', 'VIEW ONLY', 'Assigned Projects', ''],
  ['', '-PROJECTS(See Financial Data Type)', 'FULL EDIT', 'Portfolio', '', 'DASHBOARD', 'Assigned Projects', ''],
  ['PRIME CONTRACT', 'FINANCIAL DATA TYPE:   Markups (To the right of Line)', 'BLOCK, As Permit', 'Assigned Projects', 'ask', 'BLOCK ACCESS', '', ''],
  ['2.01', 'Construction Supervision', 'MODIFY', '', '', 'BLOCK ACCESS', '', ''],
  ['', 'SOMETHING NEW', 'MODIFY', '', '', '', '', ''],
  ['ACCESS  Note there is an "overall" access', 'DEFINITION', '', '', '', '', '', ''],
  ['BLOCK ACCESS', 'Cannot see anything', '', '', '', '', '', ''],
];

describe('granular access', () => {
  it('turns levels into view / manage', () => {
    expect(flagsFor('block_permit')).toEqual({ view: false, manage: false });
    expect(flagsFor('view')).toEqual({ view: true, manage: false });
    expect(flagsFor('input')).toEqual({ view: true, manage: true });
    expect(levelFrom('BLOCK, As Permit')).toBe('block_permit');
    expect(levelFrom('FULL EDIT')).toBe('full');
    expect(levelFrom('')).toBeNull();
  });

  it('reads the sheet: roles, emails (not passwords), data types', () => {
    const r = parseAccessMatrix(SHEET);
    expect(r.roles.map((x) => [x.key, x.tier, x.emails])).toEqual([['r_internal_project_manager', 'internal', ['pm@x.com']], ['r_client_open_book', 'client', []]]);
    const pm = r.roles[0];
    expect(pm.overall).toMatchObject({ level: 'modify', extent: 'assigned' });
    expect(pm.perms.projects).toMatchObject({ level: 'full', extent: 'portfolio' });
    expect(pm.perms['fin:markups']).toMatchObject({ level: 'block_permit', view: false, note: 'ask' });
    expect(Object.keys(pm.perms)).toContain('fin:gr_2.01_construction_supervision');
    expect(r.unmatched).toEqual(['SOMETHING NEW']);
    expect(keyForRow('-ESTIMATING (See Financial Data Type)  (Tools for HISTORICAL DATA)', '')?.key).toBe('estimating_history');
  });

  it('fills every menu item from the overall access, and applies a person’s overrides', () => {
    const pm = parseAccessMatrix(SHEET).roles[0];
    const map = rolePermissionsFrom(pm, ['dashboard', 'projects']);
    expect(map.dashboard).toMatchObject({ level: 'modify', extent: 'assigned', manage: true });
    expect(map.projects).toMatchObject({ level: 'full', extent: 'portfolio' });
    expect(extentOf(map)).toBe('assigned');
    const eff = effectivePermissions(map, { dashboard: { level: 'view' }, [OVERALL_KEY]: { extent: 'portfolio' } });
    expect(eff.dashboard).toMatchObject({ level: 'view', view: true, manage: false, extent: 'assigned' });
    expect(extentOf(eff)).toBe('portfolio');
    expect(extentOf({ dashboard: perm('full') })).toBe('portfolio');
  });

  it('refuses a sheet that isn’t the access matrix', () => {
    expect(() => parseAccessMatrix([['a', 'b']])).toThrow(/ROLE row/);
  });
});
