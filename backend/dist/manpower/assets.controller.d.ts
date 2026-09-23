import { ManpowerAccess } from './manpower-access.service';
import { AssetsService } from './assets.service';
export declare class AssetDto {
    assetTag?: string;
    name?: string;
    category?: string;
    serialNumber?: string;
    condition?: string;
    purchaseDate?: string;
    cost?: number;
    notes?: string;
}
export declare class AssetStatusDto {
    status: string;
}
export declare class IssueDto {
    employeeId: string;
    date?: string;
    expectedReturn?: string;
    notes?: string;
    replacesIssueId?: string;
}
export declare class ReturnDto {
    date?: string;
    condition?: string;
    toRepair?: boolean;
    chargeAmount?: number;
    notes?: string;
}
export declare class AssetsController {
    private readonly service;
    private readonly access;
    constructor(service: AssetsService, access: ManpowerAccess);
    list(): Promise<{
        currentIssue: import("../database/entities").AssetIssueEntity | null;
        id: string;
        assetTag: string;
        name: string;
        category: string;
        serialNumber: string;
        status: string;
        condition: string;
        purchaseDate: string;
        cost: number;
        notes: string;
        createdAt: string;
        updatedAt: string;
    }[]>;
    forEmployee(id: string): Promise<{
        asset: import("../database/entities").AssetEntity | undefined;
        id: string;
        assetId: string;
        employeeId: string;
        issuedAt: string;
        expectedReturn: string;
        status: string;
        returnedAt: string;
        returnCondition: string;
        chargeAmount: number;
        replacesIssueId: string;
        notes: string;
        issuedByName: string;
        closedByName: string;
    }[]>;
    history(id: string): Promise<import("../database/entities").AssetIssueEntity[]>;
    create(dto: AssetDto, a?: string): Promise<import("../database/entities").AssetEntity>;
    update(id: string, dto: AssetDto, a?: string): Promise<import("../database/entities").AssetEntity>;
    status(id: string, dto: AssetStatusDto, a?: string): Promise<import("../database/entities").AssetEntity>;
    issue(id: string, dto: IssueDto, a?: string): Promise<import("../database/entities").AssetIssueEntity>;
    ret(id: string, dto: ReturnDto, a?: string): Promise<import("../database/entities").AssetIssueEntity>;
    lost(id: string, dto: ReturnDto, a?: string): Promise<import("../database/entities").AssetIssueEntity>;
}
