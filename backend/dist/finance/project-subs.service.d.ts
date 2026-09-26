import { Repository } from 'typeorm';
import { CommitmentEntity, CommitmentLineEntity, ContractorEntity, CostEntryEntity, PersonEntity, SubcontractorTradeEntity } from '../database/entities';
import type { Actor } from '../manpower/manpower-access.service';
import { FinancialsService } from './financials.service';
export declare function expiryState(date?: string | null, today?: string): "" | "expired" | "soon" | "ok";
export declare class ProjectSubsService {
    private readonly commitments;
    private readonly lines;
    private readonly entries;
    private readonly contractors;
    private readonly people;
    private readonly trades;
    private readonly fin;
    constructor(commitments: Repository<CommitmentEntity>, lines: Repository<CommitmentLineEntity>, entries: Repository<CostEntryEntity>, contractors: Repository<ContractorEntity>, people: Repository<PersonEntity>, trades: Repository<SubcontractorTradeEntity>, fin: FinancialsService);
    list(projectId: number, actor: Actor): Promise<{
        canSeeMoney: boolean;
        canManage: boolean;
        rows: {
            key: string;
            contractorId?: string;
            company: string;
            contactPerson?: string;
            phone?: string;
            email?: string;
            trades: string[];
            licenseNumber?: string;
            licenseExpiry?: string;
            licenseState: string;
            insuranceExpiry?: string;
            insuranceState: string;
            status?: string;
            portal: boolean;
            personId?: number;
            subcontracts: {
                id: string;
                number: string;
                type: string;
                title: string;
                status: string;
                total?: number;
                billed?: number;
                remaining?: number;
            }[];
        }[];
        unlinked: {
            personId: number;
            name: string;
            company: string;
            role: string;
            phone: string;
            email: string;
            contractorId: string | undefined;
        }[];
    }>;
}
