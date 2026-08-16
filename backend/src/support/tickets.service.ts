import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketEntity } from '../database/entities';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(TicketEntity) private readonly repo: Repository<TicketEntity>,
  ) {}

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  create(dto: any) {
    const id = dto.id || 'TK-' + String(Date.now());
    const ticket = { status: 'Open', priority: 'Medium', category: 'General', createdAt: new Date().toISOString().slice(0, 10), ...dto, id };
    return this.repo.save(this.repo.create(ticket as Partial<TicketEntity>));
  }

  async update(id: string, dto: any) {
    let ticket = await this.repo.findOneBy({ id });
    if (!ticket) ticket = this.repo.create({ id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<TicketEntity>);
    Object.assign(ticket, dto, { id });
    return this.repo.save(ticket);
  }

  async remove(id: string) {
    const ticket = await this.repo.findOneBy({ id });
    if (ticket) await this.repo.remove(ticket);
    return { id, deleted: true };
  }
}
