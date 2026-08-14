import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadEntity } from '../database/entities';
import { LEAD_DROPDOWN_OPTIONS } from '../seed-data/leads';

@Injectable()
export class LeadsService {
    constructor(
        @Optional() @InjectRepository(LeadEntity) private readonly repo?: Repository<LeadEntity>,
    ) { }

    getOptions() {
        return LEAD_DROPDOWN_OPTIONS;
    }

    findAll() {
        if (!this.repo) return [];
        return this.repo.find({ order: { createdAt: 'DESC' } });
    }

    async findOne(id: string) {
        if (!this.repo) throw new NotFoundException(`Lead ${id} not found`);
        const lead = await this.repo.findOneBy({ id });
        if (!lead) throw new NotFoundException(`Lead ${id} not found`);
        return lead;
    }

    create(dto: any) {
        const lead = { id: 'LD-' + String(1000 + Date.now() % 10000), ...dto, createdAt: new Date().toISOString().slice(0, 10) };
        // No DB configured: return the record without persisting (the UI keeps
        // its own copy), so lead capture still works in in-memory mode.
        if (!this.repo) return lead;
        return this.repo.save(this.repo.create(lead as Partial<LeadEntity>));
    }

    async update(id: string, dto: any) {
        if (!this.repo) return { id, ...dto };
        const lead = await this.findOne(id);
        Object.assign(lead, dto);
        return this.repo.save(lead);
    }

    async remove(id: string) {
        if (!this.repo) return { id, deleted: true };
        const lead = await this.repo.findOneBy({ id });
        if (lead) await this.repo.remove(lead);
        return { id, deleted: true };
    }
}
