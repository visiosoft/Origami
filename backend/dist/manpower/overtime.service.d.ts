import { Repository } from 'typeorm';
import { DailyLogEntity, EmployeeEntity, LaborLogEntryEntity, OvertimeRequestEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from './manpower-access.service';
import { PayrollSetupService } from './payroll-setup.service';
export interface OvertimeInput {
    employeeId: string;
    projectId?: number;
    date: string;
    hours: number;
    otType?: string;
    rate?: number;
    reason?: string;
    source?: string;
}
export declare class OvertimeService {
    private readonly repo;
    private readonly employees;
    private readonly logs;
    private readonly entries;
    private readonly setup;
    private readonly access;
    constructor(repo: Repository<OvertimeRequestEntity>, employees: Repository<EmployeeEntity>, logs: Repository<DailyLogEntity>, entries: Repository<LaborLogEntryEntity>, setup: PayrollSetupService, access: ManpowerAccess);
    findAll(opts: {
        employeeId?: string;
        status?: string;
        from?: string;
        to?: string;
    }): Promise<OvertimeRequestEntity[]>;
    private validate;
    private build;
    create(dto: OvertimeInput, actor: Actor): Promise<OvertimeRequestEntity>;
    bulkCreate(items: OvertimeInput[], actor: Actor): Promise<OvertimeRequestEntity[]>;
    private load;
    private assertIndependent;
    approve(id: string, note: string | undefined, actor: Actor): Promise<OvertimeRequestEntity>;
    reject(id: string, note: string | undefined, actor: Actor): Promise<OvertimeRequestEntity>;
    cancel(id: string, actor: Actor): Promise<OvertimeRequestEntity>;
    suggestions(from: string, to: string): Promise<{
        employeeId: string;
        date: string;
        loggedHours: number;
        overtimeHours: number;
        projectId: number | undefined;
        otType: string;
    }[]>;
}
