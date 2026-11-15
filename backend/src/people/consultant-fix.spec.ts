import { PeopleService } from './people.service';

describe('consultants saved as their firm (Nov 10)', () => {
  const rows: any[] = [
    { id: 1, kind: 'Consultant', name: 'Kestrel Engineering', company: 'Kestrel Engineering', contact: 'Kai Lono' },
    { id: 2, kind: 'Consultant', name: 'Dana Whitfield', company: 'Whitfield Arch', contact: null },
    { id: 3, kind: 'Consultant', name: 'Lee Structural', company: '', contact: 'Ana Lee Park' },
    { id: 4, kind: 'Sub', name: 'Ortiz Framing', company: 'Ortiz Framing', contact: 'Luis Ortiz' },
  ];
  const repo = {
    find: async (o: any) => rows.filter((r) => !o?.where || r.kind === o.where.kind),
    update: async (w: any, patch: any) => Object.assign(rows.find((r) => r.id === w.id), patch),
  };
  const svc = new PeopleService(repo as any);

  it('shows who would change, and only consultants with a person on file', async () => {
    expect(await svc.consultantFixPlan()).toEqual([
      { id: 1, nameNow: 'Kestrel Engineering', nameAfter: 'Kai Lono', company: 'Kestrel Engineering' },
      { id: 3, nameNow: 'Lee Structural', nameAfter: 'Ana Lee Park', company: 'Lee Structural' },
    ]);
    expect((await svc.applyConsultantFix(false)).applied).toBe(false);
    expect(rows[0].name).toBe('Kestrel Engineering');
  });

  it('applies on confirm: the person becomes the name, the firm the company', async () => {
    expect(await svc.applyConsultantFix(true)).toEqual({ applied: true, changed: 2 });
    expect(rows[0]).toMatchObject({ name: 'Kai Lono', firstName: 'Kai', lastName: 'Lono', company: 'Kestrel Engineering', contact: null });
    expect(rows[2]).toMatchObject({ name: 'Ana Lee Park', firstName: 'Ana', lastName: 'Lee Park', company: 'Lee Structural' });
    expect(rows[3].name).toBe('Ortiz Framing');
  });
});
