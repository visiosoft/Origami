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
        return LEAD_DROPDOWN_OPTIONS;
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
        const lead = { id: 'LD-' + String(1000 + Date.now() % 10000), ...dto, createdAt: new Date().toISOString().slice(0, 10) };
        return this.repo.save(this.repo.create(lead as Partial<LeadEntity>));
    }

    async update(id: string, dto: any) {
        const lead = await this.findOne(id);
        Object.assign(lead, dto);
        return this.repo.save(lead);
    }

    async remove(id: string) {
        const lead = await this.findOne(id);
        return this.repo.remove(lead);
    }
}
