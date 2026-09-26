import { StaffDirectorySync, personFieldsFor, splitName } from './staff-directory.sync';

/** Minimal in-memory repository. */
function table(rows: any[] = []) {
  const match = (r: any, w: any) => Object.entries(w || {}).every(([k, v]) => r[k] === v);
  return {
    rows,
    find: jest.fn(async (o?: any) => rows.filter((r) => match(r, o?.where)).map((r) => r)),
    findOneBy: jest.fn(async (w: any) => rows.find((r) => match(r, w)) || null),
    create: jest.fn((x: any) => ({ ...x })),
    save: jest.fn(async (x: any) => { const i = rows.findIndex((r) => r.id === x.id); if (i >= 0) rows[i] = x; else rows.push(x); return x; }),
    remove: jest.fn(async (x: any) => { for (const it of Array.isArray(x) ? x : [x]) { const i = rows.findIndex((r) => r.id === it.id); if (i >= 0) rows.splice(i, 1); } return x; }),
    update: jest.fn(async (w: any, patch: any) => { rows.filter((r) => match(r, w)).forEach((r) => Object.assign(r, patch)); }),
  };
}

describe('People <-> Employees: one record', () => {
  const settings = { get: jest.fn(async (k: string) => (k === 'brand.companyName' ? 'Origami Design + Build' : null)) };

  it('maps the fields an employee decides onto their People entry', () => {
    expect(splitName('George Finau')).toEqual({ firstName: 'George', lastName: 'Finau' });
    expect(personFieldsFor({ name: 'George Finau', email: 'g@x.com', phone: '', designation: 'Super Intendent - Construction', jobTitle: '', trade: 'C-8 Concrete', contractorId: '', employmentType: 'contract' } as any, 'Origami Design + Build'))
      .toMatchObject({ name: 'George Finau', firstName: 'George', lastName: 'Finau', email: 'g@x.com', phone: '—', role: 'Super Intendent - Construction', kind: 'Staff', company: 'Origami Design + Build' });
    expect(personFieldsFor({ name: 'Luis Ortega', contractorId: 'K1', trade: 'Framer' } as any, 'Ortiz Framing').kind).toBe('Sub');
  });

  function setup() {
    const employees = table([
      { id: 'EMP-G', name: 'George Finau', email: 'george@origamidb.com', designation: 'Super Intendent - Construction', employmentType: 'contract', workerId: 'W-0002' },
      { id: 'EMP-L', name: 'Luis Ortega', email: '', contractorId: 'K1', employmentType: 'contractor_worker', trade: 'Framer', workerId: 'W-0003' },
    ]);
    const people = table([
      { id: 1, name: 'George F.', email: 'George@OrigamiDB.com', kind: 'Staff', tier: 'Internal', projects: ['1311 Countryside'], pronouns: 'he/him' },
      { id: 2, name: 'Jerrod H.', email: 'jerrod@origamidb.com', kind: 'Staff', role: 'Design Phase Lead', tier: 'Internal', projects: [] },
      { id: 3, name: 'Old sample', kind: 'Staff', employeeId: 'EMP-GONE', projects: [] },
      { id: 4, name: 'Tomas Perez', kind: 'Client', email: 't@x.com', projects: [] },
    ]);
    const contractors = table([{ id: 'K1', companyName: 'Ortiz Framing' }]);
    const sync = new StaffDirectorySync(employees as any, people as any, contractors as any, settings as any);
    return { sync, employees, people };
  }

  it('links existing entries by email, adds missing ones, gives People staff an employee, and drops stale ones', async () => {
    const { sync, employees, people } = setup();
    await sync.backfill();
    const george = people.rows.find((p) => p.employeeId === 'EMP-G');
    expect(george).toMatchObject({ id: 1, name: 'George Finau', role: 'Super Intendent - Construction', kind: 'Staff', projects: ['1311 Countryside'], pronouns: 'he/him' }); // directory fields kept
    expect(people.rows.find((p) => p.employeeId === 'EMP-L')).toMatchObject({ name: 'Luis Ortega', kind: 'Sub', company: 'Ortiz Framing', email: '—' });
    const jerrod = people.rows.find((p) => p.id === 2);
    expect(jerrod.employeeId).toBeTruthy();
    expect(employees.rows.find((e) => e.id === jerrod.employeeId)).toMatchObject({ name: 'Jerrod H.', designation: 'Design Phase Lead', workerId: `W-${new Date().getFullYear()}-0004` });
    expect(people.rows.some((p) => p.id === 3)).toBe(false);
    expect(people.rows.find((p) => p.id === 4).employeeId).toBeUndefined(); // clients are untouched
    // Running again changes nothing.
    const count = [people.rows.length, employees.rows.length];
    await sync.backfill();
    expect([people.rows.length, employees.rows.length]).toEqual(count);
  });

  it('carries People edits of shared fields back to the employee, and removes the entry with the employee', async () => {
    const { sync, employees, people } = setup();
    await sync.backfill();
    const george = people.rows.find((p) => p.employeeId === 'EMP-G');
    await sync.personChanged(george, { phone: '(408) 555-0100', role: 'Site Superintendent', projects: ['X'] });
    expect(employees.rows.find((e) => e.id === 'EMP-G')).toMatchObject({ phone: '(408) 555-0100', designation: 'Site Superintendent' });
    await sync.removeEmployee('EMP-G');
    expect(people.rows.some((p) => p.employeeId === 'EMP-G')).toBe(false);
  });
});
