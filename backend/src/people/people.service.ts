import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonEntity } from '../database/entities';

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(PersonEntity) private readonly repo: Repository<PersonEntity>,
  ) {}

  async findAll(project?: string) {
    const all = await this.repo.find({ order: { id: 'ASC' } });
    return project ? all.filter((p: any) => (p.projects ?? []).includes(project)) : all;
  }

  async findOne(id: string) {
    const person = await this.repo.findOneBy({ id: Number(id) });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  /**
   * Whether the given email is on record as a client on this named project.
   *
   * The People directory is the only place a client login is tied to
   * specific work -- their own account carries no project list of its own.
   */
  async isClientOnProject(email: string, projectName: string): Promise<boolean> {
    if (!email || !projectName) return false;
    const person = await this.repo
      .createQueryBuilder('p')
      .where('LOWER(p.email) = :email', { email: email.trim().toLowerCase() })
      .andWhere('p.tier = :tier', { tier: 'Client' })
      .getOne();
    return !!person?.projects?.includes(projectName);
  }

  /**
   * Tie an email to a project as a client or consultant, creating the
   * directory entry if none exists yet.
   *
   * Used when granting guest access: a guest's session works purely because
   * the rest of the app (dashboards, the Project Program's client check)
   * already scopes by this directory rather than by anything on the login
   * itself, so linking here is what actually grants the access.
   */
  async linkToProject(email: string, name: string, tier: 'Client' | 'Consultant', projectName: string) {
    const clean = (email || '').trim().toLowerCase();
    const existing = await this.repo
      .createQueryBuilder('p')
      .where('LOWER(p.email) = :email', { email: clean })
      .getOne();
    if (existing) {
      if (!(existing.projects || []).includes(projectName)) {
        existing.projects = [...(existing.projects || []), projectName];
        await this.repo.save(existing);
      }
      return existing;
    }
    const id = await this.nextId();
    const person = this.repo.create({
      id, name: name || clean, email: clean, tier, kind: tier, company: '', phone: '',
      projects: [projectName], openTasks: 0, since: new Date().toISOString().slice(0, 10), comply: null, last: 'Guest invited',
    } as Partial<PersonEntity>);
    return this.repo.save(person);
  }

  private async nextId(): Promise<number> {
    const rows = await this.repo.find();
    return rows.reduce((m: number, p: any) => Math.max(m, Number(p.id) || 0), 0) + 1;
  }

  async create(dto: any) {
    const id = Number(dto.id) || (await this.nextId());
    const person = { projects: [], openTasks: 0, comply: null, since: 'Added today', last: 'Just added', ...dto, id };
    return this.repo.save(this.repo.create(person as Partial<PersonEntity>));
  }

  async update(id: string, dto: any) {
    const numId = Number(id);
    const person = await this.repo.findOneBy({ id: numId });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    Object.assign(person, dto, { id: numId });
    return this.repo.save(person);
  }

  async remove(id: string) {
    const numId = Number(id);
    const person = await this.repo.findOneBy({ id: numId });
    if (person) await this.repo.remove(person);
    return { id: numId, deleted: true };
  }
}
