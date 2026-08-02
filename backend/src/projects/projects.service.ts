import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { randomUUID } from 'crypto';

export interface Project {
  id: string;
  name: string;
  client: string;
  phase: string;
  contractValue: number;
  exec?: string;
  contractType?: string;
}

@Injectable()
export class ProjectsService {
  private projects: Project[] = [
    { id: '1', name: 'Meridian Residence', client: 'Whitfield Family', phase: 'Construction', contractValue: 1_327_000, exec: 'DB', contractType: 'Fixed' },
    { id: '2', name: 'Civic Center Renovation', client: 'City of Westbrook', phase: 'Design', contractValue: 3_405_000, exec: 'DBB', contractType: 'T&M' },
    { id: '3', name: 'Harbor Office Build', client: 'Pacific Maritime LLC', phase: 'Preconstruction', contractValue: 535_000, exec: 'D', contractType: 'Cost+' },
    { id: '4', name: 'Lakeview Custom Home', client: 'Moreno Family', phase: 'Construction', contractValue: 892_000, exec: 'DB', contractType: 'Fixed' },
    { id: '5', name: 'Downtown Mixed-Use', client: 'Urban Dev Partners', phase: 'Design', contractValue: 6_200_000, exec: 'DBB', contractType: 'Cost+' },
    { id: '6', name: 'Hillcrest ADU', client: 'Thompson Estate', phase: 'Closeout', contractValue: 285_000, exec: 'B', contractType: 'Fixed' },
  ];

  findAll(): Project[] {
    return this.projects;
  }

  findOne(id: string): Project {
    const project = this.projects.find((p) => p.id === id);
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  create(dto: CreateProjectDto): Project {
    const project: Project = { id: randomUUID(), ...dto };
    this.projects.push(project);
    return project;
  }

  update(id: string, dto: Partial<CreateProjectDto>): Project {
    const index = this.projects.findIndex((p) => p.id === id);
    if (index === -1) throw new NotFoundException(`Project ${id} not found`);
    this.projects[index] = { ...this.projects[index], ...dto };
    return this.projects[index];
  }
}
