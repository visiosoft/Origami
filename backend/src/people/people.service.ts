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

  create(dto: any) {
    if (this.repo) return this.repo.save(this.repo.create(dto as Partial<PersonEntity>));
    const person = { id: this.mem.length + 1, projects: [], ...dto };
    this.mem = [person, ...this.mem];
    return person;
  }
}
