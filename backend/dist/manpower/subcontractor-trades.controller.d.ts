import { ManpowerAccess } from './manpower-access.service';
import { SubcontractorTradesService } from './subcontractor-trades.service';
export declare class SubcontractorTradeDto {
    code?: string;
    name?: string;
    category?: string;
    description?: string;
    active?: boolean;
    order?: number;
}
export declare class SubcontractorTradesController {
    private readonly service;
    private readonly access;
    constructor(service: SubcontractorTradesService, access: ManpowerAccess);
    list(): Promise<import("../database/entities").SubcontractorTradeEntity[]>;
    create(dto: SubcontractorTradeDto, a?: string): Promise<import("../database/entities").SubcontractorTradeEntity>;
    update(id: string, dto: SubcontractorTradeDto, a?: string): Promise<import("../database/entities").SubcontractorTradeEntity>;
    remove(id: string, a?: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
