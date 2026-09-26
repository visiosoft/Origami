import { isoDate, mapHeaders, planImport } from './people-import';

const existing: any[] = [
  { id: 1, name: 'Maria Aquino', kind: 'Client', email: 'maria@client.test' },
  { id: 2, name: 'Bayview Structural', kind: 'Consultant', email: '—' },
];
const projects = ["Aquino's Remodel", "Sergio's Store"];

describe('People import', () => {
  it('reads the template headers and common alternatives, whatever the case', () => {
    expect(mapHeaders({ KIND: 'Sub', 'Company Name': 'Ortiz Framing', 'E-mail Address': 'x', 'Zip Code': '95376', Trade: 'Framing' }))
      .toEqual({ kind: 'Sub', name: 'Ortiz Framing', email: 'x', zip: '95376', role: 'Framing' });
  });

  it('builds the People record: a sub company with licence, insurance, address and projects', () => {
    const [row] = planImport([{
      Kind: 'Subcontractor', Name: 'Ortiz Framing', 'Primary contact': 'Luis Ortiz', 'Role or trade': 'Framing', Phone: '555-0101', Email: 'Luis@Ortiz.test',
      Projects: "aquino's remodel; Nowhere", Street: '12 Oak St', City: 'Tracy', ZIP: '95376',
      'License number': '998877', 'License expires': '3/31/2027', 'Insurance carrier': 'Hartford', 'Insurance policy': 'GL-1', 'Insurance expires': '2027-01-01',
    }], existing, projects, { update: false });
    expect(row.action).toBe('create');
    expect(row.person).toMatchObject({
      kind: 'Sub', name: 'Ortiz Framing', company: 'Ortiz Framing', contact: 'Luis Ortiz', role: 'Framing', email: 'luis@ortiz.test', tier: 'Consultant',
      projects: ["Aquino's Remodel"],
      addresses: { business: { street: '12 Oak St', city: 'Tracy', state: 'CA', zip: '95376' } },
      licenses: [expect.objectContaining({ discipline: 'CSLB', number: '998877', expiresOn: '2027-03-31' })],
      insurance: { generalLiability: { carrier: 'Hartford', policy: 'GL-1', expiresOn: '2027-01-01', notApplicable: false } },
    });
    expect(row.issues).toEqual(['No project called "Nowhere" — left out']);
  });

  it('spots people already there (email, or kind + name) and only updates them when asked', () => {
    const rows = [{ Kind: 'Client', Name: 'Maria A.', Email: 'MARIA@client.test' }, { Kind: 'Consultant', Name: 'bayview structural' }];
    expect(planImport(rows, existing, projects, { update: false }).map((r) => [r.action, r.matchId])).toEqual([['skip', 1], ['skip', 2]]);
    expect(planImport(rows, existing, projects, { update: true }).map((r) => [r.action, r.matchId])).toEqual([['update', 1], ['update', 2]]);
  });

  it('flags rows it can’t use, blank rows and repeats within the file', () => {
    const plan = planImport([
      { Kind: 'Plumber?', Name: 'X' }, { Kind: 'Client', Name: '' }, { Kind: '', Name: '' },
      { Kind: 'Vendor', Name: 'Harbor Supply', Email: 'a@h.test' }, { Kind: 'Vendor', Name: 'Harbor Supply Co', Email: 'A@h.test' },
      { Kind: 'Client', 'First name': 'Ana', 'Last name': 'Ruiz', Email: 'not-an-email' },
    ], existing, projects, { update: false });
    expect(plan.map((p) => p.action)).toEqual(['error', 'error', 'skip', 'create', 'skip', 'create']);
    expect(plan[0].row).toBe(2); // spreadsheet row numbers (header is row 1)
    expect(plan[5]).toMatchObject({ name: 'Ana Ruiz', email: '' });
    expect(plan[5].issues[0]).toContain("isn't an email address");
  });

  it('dates: ISO or US style', () => {
    expect([isoDate('2027-03-31'), isoDate('3/31/2027'), isoDate('03/31/27'), isoDate('March 31')]).toEqual(['2027-03-31', '2027-03-31', '2027-03-31', '']);
  });
});
