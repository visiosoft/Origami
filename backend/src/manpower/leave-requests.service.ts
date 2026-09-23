import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRequestEntity } from '../database/entities';
import type { ManpowerActor } from './daily-logs.service';

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectRepository(LeaveRequestEntity) private readonly repo: Repository<LeaveRequestEntity>,
  ) {}

  findAll(opts: { employeeId?: string; status?: string }) {
    const where: any = {};
    if (opts.employeeId) where.employeeId = opts.employeeId;
    if (opts.status) where.status = opts.status;
    return this.repo.find({ where, order: { requestedAt: 'DESC' } });
  }

  create(dto: any, actor: ManpowerActor) {
    const id = dto.id || 'LR-' + String(Date.now());
    const request = {
      status: 'pending', requestedBy: actor.name, requestedAt: new Date().toISOString(),
      ...dto, id,
    };
    return this.repo.save(this.repo.create(request as Partial<LeaveRequestEntity>));
  }

  async decide(id: string, decision: 'approved' | 'denied', note: string | undefined, actor: ManpowerActor) {
    const request = await this.repo.findOneBy({ id });
    if (!request) throw new NotFoundException(`Leave request ${id} not found`);
    if (request.status !== 'pending') throw new BadRequestException(`This request has already been ${request.status}.`);
    request.status = decision;
    request.decidedBy = actor.name;
    request.decidedAt = new Date().toISOString();
    request.note = note || '';
    return this.repo.save(request);
  }

  async remove(id: string) {
    const request = await this.repo.findOneBy({ id });
    if (request) await this.repo.remove(request);
    return { id, deleted: true };
  }
}
