import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractorEntity, EmployeeEntity, PersonEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
import { nextWorkerId } from './workforce.util';

const blank = (v?: string | null) => !v || !v.trim() || v.trim() === '—';
const norm = (v?: string | null) => (v || '').trim().toLowerCase();
const isWorker = (e: Pick<EmployeeEntity, 'contractorId' | 'employmentType'>) => !!e.contractorId || e.employmentType === 'contractor_worker';

/** Split "Dana M. Whitfield" into the first/last parts the People profile keeps. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/**
 * The People fields an employee record decides. Everything else on the People
 * entry (projects they can see, access tier once set, pronouns, go-by name,
 * compliance) belongs to the directory and is left alone.
 */
export function personFieldsFor(e: Pick<EmployeeEntity, 'name' | 'email' | 'phone' | 'designation' | 'jobTitle' | 'trade' | 'contractorId' | 'employmentType'>, company: string) {
  const worker = isWorker(e);
  return {
    name: (e.name || '').trim(),
    ...splitName(e.name),
    email: blank(e.email) ? '—' : e.email.trim(),
    phone: blank(e.phone) ? '—' : e.phone.trim(),
    role: (e.designation || e.jobTitle || e.trade || (worker ? 'Worker' : 'Staff')).trim(),
    company,
    kind: worker ? 'Sub' : 'Staff',
  };
}

/**
 * People -> Staff (and contractor workers) and Manpower -> Employees are one
 * record: each employee has exactly one People entry (person.employeeId), and
 * the fields they share are kept in step from whichever side changes them.
 * Existing records are matched once at startup -- by the link, then email,
 * then name -- and a People "Staff" entry with no employee gets one.
 */
@Injectable()
export class StaffDirectorySync implements OnApplicationBootstrap {
  private readonly log = new Logger('StaffDirectorySync');

  constructor(
    @InjectRepository(EmployeeEntity) private readonly employees: Repository<EmployeeEntity>,
    @InjectRepository(PersonEntity) private readonly people: Repository<PersonEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    private readonly settings: SettingsService,
  ) {}

  async onApplicationBootstrap() {
    try { await this.backfill(); }
    catch (e) { this.log.warn(`People/employee sync skipped: ${(e as Error).message}`); }
  }

  private async companyFor(e: EmployeeEntity) {
    if (e.contractorId) {
      const c = await this.contractors.findOneBy({ id: e.contractorId });
      if (c?.companyName) return c.companyName;
    }
    return (await this.settings.get('brand.companyName')) || 'Origami Design + Build';
  }

  private async nextPersonId() {
    const rows = await this.people.find();
    return rows.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
  }

  /** Create or refresh the People entry for an employee; returns it. */
  async syncEmployee(e: EmployeeEntity, candidates?: PersonEntity[]): Promise<PersonEntity> {
    const all = candidates || (await this.people.find());
    let person = all.find((p) => p.employeeId === e.id)
      || (!blank(e.email) ? all.find((p) => !p.employeeId && norm(p.email) === norm(e.email)) : undefined)
      || all.find((p) => !p.employeeId && ['Staff', 'Sub'].includes(p.kind) && norm(p.name) === norm(e.name));
    const fields = personFieldsFor(e, await this.companyFor(e));
    if (!person) {
      person = this.people.create({
        id: await this.nextPersonId(), projects: [], openTasks: 0, comply: null, since: new Date().toISOString().slice(0, 10), last: 'Added from Manpower',
        tier: fields.kind === 'Staff' ? 'Internal' : 'Consultant', contact: null,
        categories: [fields.kind === 'Staff' ? 'Staff' : 'Sub'],
      } as Partial<PersonEntity>);
    }
    Object.assign(person, fields, { employeeId: e.id });
    const saved = await this.people.save(person);
    if (candidates && !candidates.includes(saved)) candidates.push(saved);
    return saved;
  }

  /** A staff member added in People becomes an employee too, linked to that entry. */
  async employeeForPerson(p: PersonEntity): Promise<EmployeeEntity> {
    const all = await this.employees.find();
    const now = new Date().toISOString();
    const emp = await this.employees.save(this.employees.create({
      id: 'EMP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      name: p.name, email: blank(p.email) ? '' : p.email, phone: blank(p.phone) ? '' : p.phone, designation: p.role || '',
      employmentType: 'full_time', employmentStatus: 'active', status: 'active', workerId: nextWorkerId(all.map((e) => e.workerId)), createdAt: now, updatedAt: now,
    } as Partial<EmployeeEntity>));
    p.employeeId = emp.id;
    await this.people.save(p);
    return emp;
  }

  /** People edited a linked entry: carry the shared fields to the employee. */
  async personChanged(p: PersonEntity, dto: Record<string, any>) {
    if (!p.employeeId) return;
    const patch: Partial<EmployeeEntity> = {};
    if ('name' in dto && dto.name?.trim()) patch.name = dto.name.trim();
    if ('email' in dto) patch.email = blank(dto.email) ? '' : String(dto.email).trim();
    if ('phone' in dto) patch.phone = blank(dto.phone) ? '' : String(dto.phone).trim();
    if ('role' in dto && dto.role?.trim()) patch.designation = dto.role.trim();
    if (Object.keys(patch).length) await this.employees.update({ id: p.employeeId }, { ...patch, updatedAt: new Date().toISOString() });
  }

  /** The employee is gone: so is their People entry (one record). */
  async removeEmployee(employeeId: string) {
    const linked = await this.people.find({ where: { employeeId } });
    if (linked.length) await this.people.remove(linked);
  }

  /** Match everything up; safe to run any number of times. */
  async backfill() {
    const [emps, people] = await Promise.all([this.employees.find(), this.people.find()]);
    const empIds = new Set(emps.map((e) => e.id));
    let linked = 0, created = 0, removed = 0;
    // Entries whose employee was deleted outside the app (e.g. sample data cleared).
    for (const p of people.filter((x) => x.employeeId && !empIds.has(x.employeeId))) {
      await this.people.remove(p); removed++;
    }
    const live = people.filter((x) => !x.employeeId || empIds.has(x.employeeId));
    for (const e of emps) {
      const before = live.find((p) => p.employeeId === e.id);
      await this.syncEmployee(e, live);
      if (!before) linked++;
    }
    // Staff in People with no employee record get one, so both lists show the same people.
    for (const p of live.filter((x) => x.kind === 'Staff' && !x.employeeId)) {
      await this.employeeForPerson(p);
      created++;
    }
    if (linked || created || removed) this.log.log(`People/employee sync: ${linked} linked, ${created} employee records created, ${removed} stale entries removed`);
  }
}
