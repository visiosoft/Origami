import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from '../database/entities';
import { PROJECTS } from '../seed-data/projects';

@Injectable()
export class ProjectsService {
  private mem: any[] = [...PROJECTS];

  constructor(
    @Optional() @InjectRepository(ProjectEntity) private readonly repo?: Repository<ProjectEntity>,
  ) {}

  findAll() {
    return this.repo ? this.repo.find({ order: { id: 'ASC' } }) : this.mem;
  }

  async findOne(id: string) {
    const project = this.repo
      ? await this.repo.findOneBy({ id: Number(id) })
      : this.mem.find((p) => String(p.id) === String(id));
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  create(dto: any) {
    if (this.repo) return this.repo.save(this.repo.create(dto as Partial<ProjectEntity>));
    const project = { id: this.mem.length + 1, ...dto };
    this.mem = [project, ...this.mem];
    return project;
  }

  async update(id: string, dto: any) {
    if (this.repo) {
      await this.repo.update({ id: Number(id) }, dto as Partial<ProjectEntity>);
      return this.findOne(id);
    }
    const i = this.mem.findIndex((p) => String(p.id) === String(id));
    if (i === -1) throw new NotFoundException(`Project ${id} not found`);
    this.mem[i] = { ...this.mem[i], ...dto };
    return this.mem[i];
  }
}
