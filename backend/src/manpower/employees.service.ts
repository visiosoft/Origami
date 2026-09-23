import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeEntity } from '../database/entities';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(EmployeeEntity) private readonly repo: Repository<EmployeeEntity>,
  ) {}

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const employee = await this.repo.findOneBy({ id });
    if (!employee) throw new NotFoundException(`Employee ${id} not found`);
    return employee;
  }

  create(dto: any) {
    const id = dto.id || 'EMP-' + String(Date.now());
    const employee = { status: 'active', createdAt: new Date().toISOString(), ...dto, id };
    return this.repo.save(this.repo.create(employee as Partial<EmployeeEntity>));
  }

  async update(id: string, dto: any) {
    const employee = await this.findOne(id);
    Object.assign(employee, dto, { id });
    return this.repo.save(employee);
  }

  async remove(id: string) {
    const employee = await this.repo.findOneBy({ id });
    if (employee) await this.repo.remove(employee);
    return { id, deleted: true };
  }
}
