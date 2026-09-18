import { ConsultantsService } from './consultants.service';
import { ConsultantEntity } from '../database/entities';
export declare class ConsultantsController {
    private readonly service;
    constructor(service: ConsultantsService);
    findAll(): Promise<ConsultantEntity[]>;
    create(dto: Partial<ConsultantEntity>): Promise<ConsultantEntity>;
    update(id: string, dto: Partial<ConsultantEntity>): Promise<ConsultantEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
