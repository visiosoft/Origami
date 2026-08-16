import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
export declare class TicketsController {
    private readonly service;
    constructor(service: TicketsService);
    findAll(): Promise<import("../database/entities").TicketEntity[]>;
    create(dto: CreateTicketDto): Promise<import("../database/entities").TicketEntity>;
    update(id: string, dto: Partial<CreateTicketDto>): Promise<import("../database/entities").TicketEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
