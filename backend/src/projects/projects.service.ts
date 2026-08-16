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

  async create(dto: any) {
    const rows = await this.repo.find();
    const id = Number(dto.id) || rows.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
    return this.repo.save(this.repo.create({ ...dto, id } as Partial<ProjectEntity>));
  }

  async update(id: string, dto: any) {
    await this.repo.update({ id: Number(id) }, dto as Partial<ProjectEntity>);
    return this.findOne(id);
  }
}
