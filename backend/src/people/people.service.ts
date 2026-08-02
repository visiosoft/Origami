import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePersonDto } from './dto/create-person.dto';
import { randomUUID } from 'crypto';

export interface Person {
  id: string;
  name: string;
  kind: string;
  role: string;
  company?: string;
  phone?: string;
  email?: string;
  projects: string[];
  complianceDate?: string;
}

@Injectable()
export class PeopleService {
  private people: Person[] = [
    { id: '1', name: 'Sarah Chen', kind: 'Internal', role: 'Project Manager', projects: ['Meridian Residence', 'Civic Center Renovation'], email: 'sarah@origami.build' },
    { id: '2', name: 'Marcus Rivera', kind: 'Internal', role: 'Site Superintendent', projects: ['Meridian Residence'], email: 'marcus@origami.build' },
    { id: '3', name: 'James Park', kind: 'Subcontractor', role: 'Electrical', company: 'Park Electric', projects: ['Harbor Office Build', 'Lakeview Custom Home'], complianceDate: '2027-03-15' },
    { id: '4', name: 'Emily Nguyen', kind: 'Consultant', role: 'Structural Engineer', company: 'SN Engineering', projects: ['Downtown Mixed-Use'], complianceDate: '2026-11-01' },
    { id: '5', name: 'David Kim', kind: 'Internal', role: 'Designer', projects: ['Civic Center Renovation', 'Downtown Mixed-Use'], email: 'david@origami.build' },
  ];

  findAll(project?: string): Person[] {
    if (project) {
      return this.people.filter((p) => p.projects.includes(project));
    }
    return this.people;
  }

  findOne(id: string): Person {
    const person = this.people.find((p) => p.id === id);
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  create(dto: CreatePersonDto): Person {
    const person: Person = { id: randomUUID(), projects: [], ...dto };
    this.people.push(person);
    return person;
  }
}
