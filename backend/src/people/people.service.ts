import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonEntity } from '../database/entities';
import { PEOPLE } from '../seed-data/people';

@Injectable()
export class PeopleService {
  private mem: any[] = [...PEOPLE];

  constructor(
    @Optional() @InjectRepository(PersonEntity) private readonly repo?: Repository<PersonEntity>,
  ) {}

  async findAll(project?: string) {
    const all = this.repo ? await this.repo.find({ order: { id: 'ASC' } }) : this.mem;
    return project ? all.filter((p: any) => (p.projects ?? []).includes(project)) : all;
  }

  async findOne(id: string) {
    const person = this.repo
      ? await this.repo.findOneBy({ id: Number(id) })
      : this.mem.find((p) => String(p.id) === String(id));
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  private async nextId(): Promise<number> {
    const rows = this.repo ? await this.repo.find() : this.mem;
    return rows.reduce((m: number, p: any) => Math.max(m, Number(p.id) || 0), 0) + 1;
  }

  async create(dto: any) {
    const id = Number(dto.id) || (await this.nextId());
    const person = { projects: [], openTasks: 0, comply: null, since: 'Added today', last: 'Just added', ...dto, id };
    if (this.repo) return this.repo.save(this.repo.create(person as Partial<PersonEntity>));
    this.mem = [person, ...this.mem];
    return person;
  }

  async update(id: string, dto: any) {
    const numId = Number(id);
    if (!this.repo) {
      this.mem = this.mem.map((p) => (Number(p.id) === numId ? { ...p, ...dto, id: numId } : p));
      return this.mem.find((p) => Number(p.id) === numId);
    }
    const person = await this.repo.findOneBy({ id: numId });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    Object.assign(person, dto, { id: numId });
    return this.repo.save(person);
  }

  async remove(id: string) {
    const numId = Number(id);
    if (!this.repo) {
      this.mem = this.mem.filter((p) => Number(p.id) !== numId);
      return { id: numId, deleted: true };
    }
    const person = await this.repo.findOneBy({ id: numId });
    if (person) await this.repo.remove(person);
    return { id: numId, deleted: true };
  }
}
