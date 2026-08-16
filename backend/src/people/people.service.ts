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
