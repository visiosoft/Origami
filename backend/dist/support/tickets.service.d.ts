import { Repository } from 'typeorm';
import { TicketEntity } from '../database/entities';
export declare class TicketsService {
    private readonly repo;
    constructor(repo: Repository<TicketEntity>);
    findAll(): Promise<TicketEntity[]>;
    create(dto: any): Promise<TicketEntity>;
    update(id: string, dto: any): Promise<TicketEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
