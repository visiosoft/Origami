import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractorBidEntity, ContractorEntity, ProjectEntity } from '../database/entities';
import { cleanBid } from './contractor-bids';
import { newId } from './workforce.util';

/** A subcontractor's estimates: what they priced, for which job, and whether they got it. */
@Injectable()
export class ContractorBidsService {
  constructor(
    @InjectRepository(ContractorBidEntity) private readonly repo: Repository<ContractorBidEntity>,
    @InjectRepository(ContractorEntity) private readonly contractors: Repository<ContractorEntity>,
    @InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>,
  ) {}

  async list(contractorId: string) {
    const rows = await this.repo.findBy({ contractorId });
    const names = new Map((await this.projects.find()).map((p: any) => [p.id, p.name]));
    return rows
      .map((r) => ({ ...r, projectName: (r.projectId != null && names.get(r.projectId)) || r.projectName || (r.projectId != null ? `Project ${r.projectId}` : '') }))
      .sort((a, b) => b.dateReceived.localeCompare(a.dateReceived) || String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  /** The project's name is copied on, so it reads right even if the project is later deleted. */
  private async withName(patch: Record<string, any>) {
    if (patch.projectId != null) {
      const p: any = await this.projects.findOneBy({ id: patch.projectId } as any);
      if (p?.name) patch.projectName = p.name;
    }
    return patch;
  }

  async create(contractorId: string, dto: any, actor: { name: string }) {
    if (!(await this.contractors.findOneBy({ id: contractorId }))) throw new NotFoundException('Contractor not found.');
    const patch = await this.withName(cleanBid(dto));
    const now = new Date().toISOString();
    if (patch.outcome !== 'pending' && !patch.outcomeDate) patch.outcomeDate = now.slice(0, 10);
    await this.repo.save(this.repo.create({ ...patch, id: newId('BID'), contractorId, createdByName: actor.name, createdAt: now, updatedAt: now } as Partial<ContractorBidEntity>));
    return this.list(contractorId);
  }

  async update(id: string, dto: any) {
    const bid = await this.repo.findOneBy({ id });
    if (!bid) throw new NotFoundException('Estimate not found.');
    const patch = await this.withName(cleanBid(dto, true));
    // A new outcome is dated today unless a date was given.
    if (patch.outcome && patch.outcome !== bid.outcome && patch.outcomeDate === undefined) patch.outcomeDate = patch.outcome === 'pending' ? null : new Date().toISOString().slice(0, 10);
    await this.repo.save({ ...bid, ...patch, updatedAt: new Date().toISOString() });
    return this.list(bid.contractorId);
  }

  async remove(id: string) {
    const bid = await this.repo.findOneBy({ id });
    if (!bid) return [];
    await this.repo.delete({ id });
    return this.list(bid.contractorId);
  }
}
