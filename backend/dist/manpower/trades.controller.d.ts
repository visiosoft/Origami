import { TradesService } from './trades.service';
export declare class TradeDto {
    id?: string;
    name: string;
    active?: boolean;
    order?: number;
}
export declare class TradesController {
    private readonly service;
    constructor(service: TradesService);
    findAll(): Promise<import("../database/entities").TradeEntity[]>;
    create(dto: TradeDto): Promise<import("../database/entities").TradeEntity>;
    update(id: string, dto: Partial<TradeDto>): Promise<import("../database/entities").TradeEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
