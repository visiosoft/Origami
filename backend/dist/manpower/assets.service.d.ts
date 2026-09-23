import { Repository } from 'typeorm';
import { AssetEntity, AssetIssueEntity, EmployeeEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from './manpower-access.service';
export declare const ASSET_CATEGORIES: string[];
export declare function nextAssetTag(tags: (string | null | undefined)[]): string;
export declare class AssetsService {
    private readonly assets;
    private readonly issues;
    private readonly employees;
    private readonly access;
    constructor(assets: Repository<AssetEntity>, issues: Repository<AssetIssueEntity>, employees: Repository<EmployeeEntity>, access: ManpowerAccess);
    list(): Promise<{
        currentIssue: AssetIssueEntity | null;
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
    history(assetId: string): Promise<AssetIssueEntity[]>;
    forEmployee(employeeId: string): Promise<{
        asset: AssetEntity | undefined;
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
    private checkFields;
    create(dto: Partial<AssetEntity>, actor: Actor): Promise<AssetEntity>;
    update(id: string, dto: Partial<AssetEntity>, actor: Actor): Promise<AssetEntity>;
    setStatus(id: string, status: string, actor: Actor): Promise<AssetEntity>;
    private load;
    issue(assetId: string, dto: {
        employeeId: string;
        date?: string;
        expectedReturn?: string;
        notes?: string;
        replacesIssueId?: string;
    }, actor: Actor): Promise<AssetIssueEntity>;
    private openIssue;
    returnIssue(id: string, dto: {
        date?: string;
        condition?: string;
        toRepair?: boolean;
        chargeAmount?: number;
        notes?: string;
    }, actor: Actor): Promise<AssetIssueEntity>;
    reportLost(id: string, dto: {
        date?: string;
        chargeAmount?: number;
        notes?: string;
    }, actor: Actor): Promise<AssetIssueEntity>;
}
