import { ContractorDirectorySync } from './contractor-directory.sync';

function repo(rows: any[], key = 'id') {
  return {
    rows,
    find: async () => rows,
    create: (x: any) => ({ ...x }),
    save: async (r: any) => { const i = rows.findIndex((x) => x[key] === r[key]); if (i >= 0) rows[i] = r; else rows.push(r); return r; },
    update: async (w: any, patch: any) => { const r = rows.find((x) => x[key] === w[key]); if (r) Object.assign(r, patch); },
    delete: async (w: any) => { const i = rows.findIndex((x) => x[key] === w[key]); if (i >= 0) rows.splice(i, 1); },
    remove: async (list: any[]) => { for (const r of list) rows.splice(rows.indexOf(r), 1); },
    count: async (o: any) => rows.filter((r) => Object.entries(o.where).every(([k, v]) => r[k] === v)).length,
  };
}

function setup(people: any[] = [], contractors: any[] = [], employees: any[] = []) {
  const p = repo(people), c = repo(contractors), e = repo(employees);
  return { sync: new ContractorDirectorySync(p as any, c as any, e as any), people: p.rows, contractors: c.rows };
}

describe('one subcontractor, one record (People <-> Contractors)', () => {
  it('a sub company added in People becomes a contractor, linked both ways', async () => {
    const { sync, people, contractors } = setup([{ id: 9, kind: 'Sub', name: 'Ruiz Electric', company: 'Ruiz Electric', contact: 'Ana Ruiz', phone: '555-0199', email: 'ana@ruiz.test' }]);
    await sync.contractorForPerson(people[0]);
    expect(contractors).toHaveLength(1);
    expect(contractors[0]).toMatchObject({ companyName: 'Ruiz Electric', contactPerson: 'Ana Ruiz', phone: '555-0199', email: 'ana@ruiz.test', personId: 9, status: 'active' });
    expect(people[0].contractorId).toBe(contractors[0].id);
  });

  it('a contractor added in Manpower appears in People as a Sub', async () => {
    const { sync, people } = setup([], [{ id: 'CTR-1', companyName: 'Ortiz Framing', contactPerson: 'Luis Ortiz', phone: '555-0101', email: '' }]);
    const p = await sync.syncContractor({ id: 'CTR-1', companyName: 'Ortiz Framing', contactPerson: 'Luis Ortiz', phone: '555-0101', email: '' } as any);
    expect(people).toHaveLength(1);
    expect(p).toMatchObject({ kind: 'Sub', name: 'Ortiz Framing', company: 'Ortiz Framing', contact: 'Luis Ortiz', phone: '555-0101', email: '—', tier: 'Consultant', contractorId: 'CTR-1' });
  });

  it('matches an existing People entry by name or email instead of duplicating it -- but never a worker', async () => {
    const { sync, people } = setup([
      { id: 3, kind: 'Sub', name: 'Luis Ortiz', company: 'Ortiz Framing', employeeId: 'EMP-7', email: 'luis@ortiz.test' }, // a worker
      { id: 4, kind: 'Sub', name: 'Ortiz Framing', company: 'Ortiz Framing', email: '—' },                                    // the company
    ]);
    await sync.syncContractor({ id: 'CTR-1', companyName: 'Ortiz Framing', email: 'luis@ortiz.test' } as any);
    expect(people).toHaveLength(2);
    expect(people.find((x) => x.id === 4).contractorId).toBe('CTR-1');
    expect(people.find((x) => x.id === 3).contractorId).toBeUndefined();
  });

  it('People edits carry over: firm name, contact, phone, email and the login', async () => {
    const { sync, people, contractors } = setup(
      [{ id: 4, kind: 'Sub', name: 'Ortiz Framing Inc', company: 'Ortiz Framing', contractorId: 'CTR-1', contact: 'Luis', phone: '1', email: 'x@y.co', userId: 'U-9' }],
      [{ id: 'CTR-1', companyName: 'Ortiz Framing' }],
    );
    await sync.personChanged(people[0], { name: 'Ortiz Framing Inc', contact: 'Luis', phone: '1', email: 'x@y.co', userId: 'U-9' });
    expect(contractors[0]).toMatchObject({ companyName: 'Ortiz Framing Inc', contactPerson: 'Luis', phone: '1', email: 'x@y.co', userId: 'U-9' });
    expect(people[0].company).toBe('Ortiz Framing Inc');
  });

  it('deleting either side deletes the other; a contractor with workers can’t be deleted from People', async () => {
    const a = setup([{ id: 4, kind: 'Sub', name: 'X', contractorId: 'CTR-1' }], [{ id: 'CTR-1', companyName: 'X' }], [{ id: 'EMP-1', contractorId: 'CTR-1' }]);
    await expect(a.sync.removeForPerson(a.people[0])).rejects.toThrow('worker');
    const b = setup([{ id: 4, kind: 'Sub', name: 'X', contractorId: 'CTR-1' }], [{ id: 'CTR-1', companyName: 'X' }]);
    await b.sync.removeForPerson(b.people[0]);
    expect(b.contractors).toHaveLength(0);
    const c = setup([{ id: 4, kind: 'Sub', name: 'X', contractorId: 'CTR-1' }]);
    await c.sync.removeContractor('CTR-1');
    expect(c.people).toHaveLength(0);
  });

  it('start-up backfill links everything once and is idempotent', async () => {
    const { sync, people, contractors } = setup(
      [{ id: 1, kind: 'Sub', name: 'Ruiz Electric', company: 'Ruiz Electric' }, { id: 2, kind: 'Client', name: 'Maria' }],
      [{ id: 'CTR-1', companyName: 'Ortiz Framing', userId: 'U-5' }],
    );
    await sync.backfill();
    expect(contractors.map((c) => c.companyName).sort()).toEqual(['Ortiz Framing', 'Ruiz Electric']);
    expect(people.filter((p) => p.kind === 'Sub').every((p) => p.contractorId)).toBe(true);
    expect(people.find((p) => p.name === 'Ortiz Framing').userId).toBe('U-5');
    const counts = [people.length, contractors.length];
    await sync.backfill();
    expect([people.length, contractors.length]).toEqual(counts);
  });
});

describe('licence and insurance are the same on both sides', () => {
  it('contractor -> People: CSLB licence and general liability', async () => {
    const { sync } = setup();
    const p = await sync.syncContractor({ id: 'CTR-1', companyName: 'Ortiz Framing', licenseNumber: '998877', licenseExpiry: '2027-03-31', insuranceProvider: 'Hartford', insurancePolicyNumber: 'GL-1', insuranceExpiry: '2027-01-01' } as any);
    expect((p.licenses as any[])[0]).toMatchObject({ discipline: 'CSLB', number: '998877', expiresOn: '2027-03-31' });
    expect((p.insurance as any).generalLiability).toMatchObject({ carrier: 'Hartford', policy: 'GL-1', expiresOn: '2027-01-01' });
  });

  it('People -> contractor when the licence or insurance is edited there', async () => {
    const { sync, people, contractors } = setup(
      [{ id: 4, kind: 'Sub', name: 'X', contractorId: 'CTR-1', licenses: [{ discipline: 'CSLB', number: '123', expiresOn: '2026-12-31' }], insurance: { generalLiability: { carrier: 'Acme', policy: 'P9', expiresOn: '2026-11-30' } } }],
      [{ id: 'CTR-1', companyName: 'X' }],
    );
    await sync.personChanged(people[0], { licenses: people[0].licenses, insurance: people[0].insurance });
    expect(contractors[0]).toMatchObject({ licenseNumber: '123', licenseExpiry: '2026-12-31', insuranceProvider: 'Acme', insurancePolicyNumber: 'P9', insuranceExpiry: '2026-11-30' });
  });
});
