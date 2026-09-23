import { CsiCodesService } from './csi-codes.service';
import { CreateCsiCodeDto } from './dto/csi-code.dto';
export declare class CsiCodesController {
    private readonly service;
    constructor(service: CsiCodesService);
    findAll(): Promise<import("../database/entities").CsiCodeEntity[]>;
    create(dto: CreateCsiCodeDto): Promise<import("../database/entities").CsiCodeEntity>;
    update(id: string, dto: Partial<CreateCsiCodeDto>): Promise<import("../database/entities").CsiCodeEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
