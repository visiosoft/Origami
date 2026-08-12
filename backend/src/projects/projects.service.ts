import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../database/entities';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity) private readonly repo: Repository<ProjectEntity>,
  ) {}

  findAll() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: string) {
    const project = await this.repo.findOneBy({ id: Number(id) });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  create(dto: any) {
    return this.repo.save(this.repo.create(dto as Partial<ProjectEntity>));
  }

  async update(id: string, dto: any) {
    await this.repo.update({ id: Number(id) }, dto as Partial<ProjectEntity>);
    return this.findOne(id);
  }
}
