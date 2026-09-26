import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractorEntity, EmployeeEntity, PersonEntity } from '../database/entities';

const blank = (v?: string | null) => !v || !v.trim() || v.trim() === '—';
const val = (v?: string | null) => (blank(v) ? '' : v!.trim());
const same = (a?: string | null, b?: string | null) => !!val(a) && val(a).toLowerCase() === val(b).toLowerCase();

/**
 * Licence and insurance, the same on both sides: the contractor's licence
 * number / expiry is the People entry's CSLB licence, its insurance is the
 * general-liability policy. A blank on one side never wipes the other.
 */
function complianceToPerson(c: ContractorEntity, p: Partial<PersonEntity>) {
  if (val(c.licenseNumber) || val(c.licenseExpiry)) {
    const list: any[] = Array.isArray(p.licenses) ? [...(p.licenses as any[])] : [];
    const i = list.findIndex((l) => (l?.discipline || 'CSLB') === 'CSLB');
    const cur = i >= 0 ? list[i] : { id: 'L-' + Math.random().toString(36).slice(2, 9), discipline: 'CSLB', licenseType: '', state: 'CA', notes: '' };
    const next = { ...cur, number: val(c.licenseNumber) || cur.number || '', expiresOn: val(c.licenseExpiry) || cur.expiresOn || '' };
    if (i >= 0) list[i] = next; else list.push(next);
    p.licenses = list as any;
  }
  if (val(c.insuranceProvider) || val(c.insurancePolicyNumber) || val(c.insuranceExpiry)) {
    const ins: any = p.insurance && typeof p.insurance === 'object' ? { ...(p.insurance as any) } : {};
    const gl = ins.generalLiability || { carrier: '', policy: '', expiresOn: '', notApplicable: false };
    ins.generalLiability = { ...gl, carrier: val(c.insuranceProvider) || gl.carrier, policy: val(c.insurancePolicyNumber) || gl.policy, expiresOn: val(c.insuranceExpiry) || gl.expiresOn, notApplicable: false };
    if (!ins.workersComp) ins.workersComp = { carrier: '', policy: '', expiresOn: '', notApplicable: false };
    p.insurance = ins;
  }
}
function complianceToContractor(p: Partial<PersonEntity>): Partial<ContractorEntity> {
  const out: Partial<ContractorEntity> = {};
  const lic = (Array.isArray(p.licenses) ? (p.licenses as any[]) : []).find((l) => (l?.discipline || 'CSLB') === 'CSLB');
  if (lic) { out.licenseNumber = val(lic.number); out.licenseExpiry = val(lic.expiresOn); }
  const gl = (p.insurance as any)?.generalLiability;
  if (gl && !gl.notApplicable) { out.insuranceProvider = val(gl.carrier); out.insurancePolicyNumber = val(gl.policy); out.insuranceExpiry = val(gl.expiresOn); }
  return out;
}

/** A People entry that is a subcontracting company -- not one of its workers (those carry an employeeId). */
export const isSubCompany = (p: Pick<PersonEntity, 'kind' | 'employeeId'>) => p.kind === 'Sub' && !p.employeeId;

/**
 * One subcontractor, one record: a company in People (kind "Sub") and in
 * Manpower -> Contractors are the same thing, linked both ways
 * (PersonEntity.contractorId <-> ContractorEntity.personId). Adding it in
 * either place creates it in the other; the shared fields -- firm name,
 * contact, phone, email and the login -- stay in step; deleting one deletes
 * the other. Writes go straight to the repositories, never back through the
 * other service, so an update can't bounce between them.
 */
@Injectable()
export class ContractorDirectorySync implements OnApplicationBootstrap {
  private readonly log = new Logger('ContractorDirectorySync');

  constructor(
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
  ) {}

  private async nextPersonId() {
    const rows = await this.people.find({ select: { id: true } as any });
    return rows.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
  }

  /** Contractor -> its People entry (created, found or updated). */
  async syncContractor(c: ContractorEntity, candidates?: PersonEntity[]): Promise<PersonEntity> {
    const all = candidates || (await this.people.find());
    let p = all.find((x) => x.id === Number(c.personId) && isSubCompany(x))
      || all.find((x) => x.contractorId === c.id)
      || all.find((x) => isSubCompany(x) && !x.contractorId && (same(x.email, c.email) || same(x.name, c.companyName) || same(x.company, c.companyName)));
    const fields = {
      kind: 'Sub', name: c.companyName, company: c.companyName, contact: val(c.contactPerson),
      phone: val(c.phone) || '—', email: val(c.email) || '—', contractorId: c.id, ...(c.userId ? { userId: c.userId } : {}),
    };
    if (!p) {
      p = this.people.create({
        id: await this.nextPersonId(), ...fields, role: 'Subcontractor', tier: 'Consultant', categories: ['Sub'],
        projects: [], openTasks: 0, comply: null, since: 'Added today', last: 'Just added',
      } as Partial<PersonEntity>);
    } else {
      Object.assign(p, fields);
    }
    complianceToPerson(c, p);
    const saved = await this.people.save(p);
    if (candidates && !candidates.includes(saved)) candidates.push(saved);
    const back: Partial<ContractorEntity> = {};
    if (Number(c.personId) !== saved.id) back.personId = saved.id;
    if (!c.userId && saved.userId) back.userId = saved.userId; // login given from People
    if (Object.keys(back).length) await this.contractors.update({ id: c.id }, back);
    return saved;
  }

  /** A sub company added in People becomes a contractor too. */
  async contractorForPerson(p: PersonEntity): Promise<ContractorEntity | null> {
    if (!isSubCompany(p) || p.contractorId) return null;
    const now = new Date().toISOString();
    const c = await this.contractors.save(this.contractors.create({
      id: 'CTR-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyName: val(p.company) || p.name, contactPerson: val(p.contact), phone: val(p.phone), email: val(p.email),
      personId: p.id, status: 'active', attachments: [], tradeIds: [], createdAt: now, updatedAt: now, ...(p.userId ? { userId: p.userId } : {}),
      ...complianceToContractor(p),
    } as Partial<ContractorEntity>));
    p.contractorId = c.id;
    await this.people.save(p);
    return c;
  }

  /** People edits that change the contractor: firm name, contact, phone, email, login. */
  async personChanged(p: PersonEntity, dto: Record<string, unknown>) {
    if (!isSubCompany(p)) return;
    if (!p.contractorId) { await this.contractorForPerson(p); return; } // just became a Sub
    const patch: Partial<ContractorEntity> = {};
    if ('name' in dto || 'company' in dto) patch.companyName = p.name || val(p.company);
    if ('contact' in dto) patch.contactPerson = val(p.contact);
    if ('phone' in dto) patch.phone = val(p.phone);
    if ('email' in dto) patch.email = val(p.email);
    if ('userId' in dto) patch.userId = (p.userId || null) as any;
    if ('licenses' in dto || 'insurance' in dto) Object.assign(patch, complianceToContractor(p));
    if (Object.keys(patch).length) await this.contractors.update({ id: p.contractorId }, { ...patch, updatedAt: new Date().toISOString() });
    // Keep "company shown in lists" in step with the firm name.
    if ('name' in dto && !('company' in dto) && p.company !== p.name) { p.company = p.name; await this.people.save(p); }
  }

  /** Deleting the People entry deletes the contractor -- unless it still has workers on file. */
  async removeForPerson(p: PersonEntity) {
    if (!p.contractorId) return;
    const workers = await this.employees.count({ where: { contractorId: p.contractorId } });
    if (workers) throw new BadRequestException(`${p.name} still has ${workers} worker${workers === 1 ? '' : 's'} on file in Manpower -> Contractors -- move or remove them first.`);
    await this.contractors.delete({ id: p.contractorId });
  }

  /** Deleting the contractor deletes its People entry. */
  async removeContractor(contractorId: string) {
    const linked = (await this.people.find()).filter((p) => p.contractorId === contractorId && isSubCompany(p));
    if (linked.length) await this.people.remove(linked);
  }

  /** Once at start-up: link or create the other half of every contractor and every sub company. */
  async backfill() {
    const [contractors, people] = await Promise.all([this.contractors.find(), this.people.find()]);
    let linked = 0, created = 0;
    for (const c of contractors) {
      const before = people.length;
      await this.syncContractor(c, people);
      if (people.length > before) created++; else linked++;
    }
    for (const p of people.filter((x) => isSubCompany(x) && !x.contractorId)) {
      if (await this.contractorForPerson(p)) created++;
    }
    if (created) this.log.log(`Subcontractors: ${linked} linked, ${created} created on the other side`);
  }

  async onApplicationBootstrap() {
    try { await this.backfill(); } catch (err) { this.log.warn('Subcontractor sync skipped: ' + (err as Error).message); }
  }
}
