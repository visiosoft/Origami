import { Injectable, NotFoundException } from '@nestjs/common';
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

    create(dto: any) {
        // Prefer a caller-supplied id so a lead links 1:1 with its pipeline deal
        // (PL-…). Fall back to an LD- id only for standalone leads.
        const id = dto.id || 'LD-' + String(1000 + Date.now() % 10000);
        const lead = { ...dto, id, createdAt: new Date().toISOString().slice(0, 10) };
        return this.repo.save(this.repo.create(lead as Partial<LeadEntity>));
    }

    // Upsert: "Save Lead Details" targets the deal id, which may not have a
    // leads row yet — create it in that case instead of 404-ing.
    async update(id: string, dto: any) {
        let lead = await this.repo.findOneBy({ id });
        if (!lead) {
            lead = this.repo.create({ ...dto, id, createdAt: new Date().toISOString().slice(0, 10) } as Partial<LeadEntity>);
        } else {
            Object.assign(lead, dto);
        }
        return this.repo.save(lead);
    }

    async remove(id: string) {
        const lead = await this.repo.findOneBy({ id });
        if (lead) await this.repo.remove(lead);
        return { id, deleted: true };
    }
}
