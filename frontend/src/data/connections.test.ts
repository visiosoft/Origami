import { describe, expect, it } from 'vitest';
import { companyOf, formerPeopleOf, type Person } from './people';

const p = (o: Partial<Person>) => ({ id: 0, name: '', role: '', company: '', kind: 'Client', tier: 'Client', phone: '', email: '', projects: [], openTasks: 0, since: '', last: '', ...o } as Person);

describe('connections', () => {
  const lono = p({ id: 1, name: 'Lono Builders', kind: 'Sub', contact: 'Ana Lono' });
  const kai = p({ id: 2, name: 'Kai', kind: 'Client', company: 'Kestrel Electric', formerCompanies: [{ company: 'lono builders' }] });
  const ivy = p({ id: 3, name: 'Ivy', kind: 'Client', company: 'Acme', formerCompanies: [{ company: 'Other', personId: 1 }] });
  it('a company is its own name; a person works at their company', () => {
    expect(companyOf(lono)).toBe('Lono Builders');
    expect(companyOf(kai)).toBe('Kestrel Electric');
  });
  it('former people match by company name or a link to the record', () => {
    expect(formerPeopleOf(lono, [lono, kai, ivy]).map((x) => x.id)).toEqual([2, 3]);
    expect(formerPeopleOf(kai, [lono, kai, ivy])).toEqual([]);
  });
});
