import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadEntity } from '../database/entities';
import { LEAD_DROPDOWN_OPTIONS } from '../seed-data/leads';

@Injectable()
export class LeadsService {
    constructor(
        @InjectRepository(LeadEntity) private readonly repo: Repository<LeadEntity>,
    ) { }

    getOptions() {
        return LEAD_DROPDOWN_OPTIONS; // static dropdown config, not row data
    }

    findAll() {
        return this.repo.find({ order: { createdAt: 'DESC' } });
    }

    async findOne(id: string) {
        const lead = await this.repo.findOneBy({ id });
        if (!lead) throw new NotFoundException(`Lead ${id} not found`);
        return lead;
    }

    async create(dto: any) {
        // Prefer a caller-supplied id so a lead links 1:1 with its pipeline deal
        // (PL-…). Fall back to an LD- id only for standalone leads. The old
        // `% 10000` truncation gave only 10,000 possible values -- collision-
        // prone under normal use, and save() upserts by primary key, so a
        // collision would silently merge onto an unrelated existing lead.
        const id = dto.id || 'LD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        // Guard explicitly rather than relying on ids never colliding -- see above.
        if (await this.repo.findOneBy({ id })) {
            throw new ConflictException(`A lead with id ${id} already exists`);
        }
        const lead = { ...dto, id, createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() };
        return this.repo.save(this.repo.create(lead as Partial<LeadEntity>));
    }

    // Upsert: "Save Lead Details" targets the deal id, which may not have a
    // leads row yet — create it in that case instead of 404-ing.
    //
    // expectedUpdatedAt, when sent, guards against a save that started from a
    // stale copy overwriting a newer one -- only enforced when the row
    // already has its own updatedAt stamp, so a lead saved before this
    // existed doesn't start failing every save.
    async update(id: string, dto: any) {
        let lead = await this.repo.findOneBy({ id });
        const now = new Date().toISOString();
        if (!lead) {
            const { expectedUpdatedAt, ...patch } = dto;
            lead = this.repo.create({ ...patch, id, createdAt: new Date().toISOString().slice(0, 10), updatedAt: now } as Partial<LeadEntity>);
            return this.repo.save(lead);
        }
        if (dto.expectedUpdatedAt && lead.updatedAt && dto.expectedUpdatedAt !== lead.updatedAt) {
            throw new ConflictException('This lead was updated by someone else since you loaded it. Reload and reapply your changes.');
        }
        const { expectedUpdatedAt, ...patch } = dto;
        Object.assign(lead, patch, { updatedAt: now });
        return this.repo.save(lead);
    }

    async remove(id: string) {
        const lead = await this.repo.findOneBy({ id });
        if (lead) await this.repo.remove(lead);
        return { id, deleted: true };
    }
}
