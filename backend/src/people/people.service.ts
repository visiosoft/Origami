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
    return project ? all.filter((p) => (p.projects ?? []).includes(project)) : all;
  }

  async findOne(id: string) {
    const person = await this.repo.findOneBy({ id: Number(id) });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  create(dto: any) {
    return this.repo.save(this.repo.create(dto as Partial<PersonEntity>));
  }
}
