import { Repository } from 'typeorm';
import { AccommodationIssueEntity, AccommodationUnitEntity, AssetEntity, AssetIssueEntity, BedAllocationEntity, ContractorEntity, CsiCodeEntity, DailyLogEntity, EmployeeAdvanceEntity, EmployeeAssignmentEntity, EmployeeEntity, EmployeeRecordEntity, LaborLogEntryEntity, LeaveAdjustmentEntity, LeaveRequestEntity, OvertimeRequestEntity, PayrollRunEntity, PayslipEntity, ProjectEntity, ShiftAssignmentEntity, SubcontractorTradeEntity, TransportAssignmentEntity, TransportRouteEntity, WorkforceRequestEntity } from '../database/entities';
import { ManpowerAccess, type Actor } from './manpower-access.service';
import { PayrollSetupService } from './payroll-setup.service';
export declare const SAMPLE = "DEMO-";
export declare class SampleDataService {
    private readonly employees;
    private readonly contractors;
    private readonly subTrades;
    private readonly projects;
    private readonly csi;
    private readonly records;
    private readonly assignments;
    private readonly requests;
    private readonly logs;
    private readonly entries;
    private readonly leave;
    private readonly leaveAdj;
    private readonly overtime;
    private readonly advances;
    private readonly shifts;
    private readonly assets;
    private readonly assetIssues;
    private readonly units;
    private readonly beds;
    private readonly complaints;
    private readonly routes;
    private readonly riders;
    private readonly payslips;
    private readonly runs;
    private readonly setup;
    private readonly access;
    constructor(employees: Repository<EmployeeEntity>, contractors: Repository<ContractorEntity>, subTrades: Repository<SubcontractorTradeEntity>, projects: Repository<ProjectEntity>, csi: Repository<CsiCodeEntity>, records: Repository<EmployeeRecordEntity>, assignments: Repository<EmployeeAssignmentEntity>, requests: Repository<WorkforceRequestEntity>, logs: Repository<DailyLogEntity>, entries: Repository<LaborLogEntryEntity>, leave: Repository<LeaveRequestEntity>, leaveAdj: Repository<LeaveAdjustmentEntity>, overtime: Repository<OvertimeRequestEntity>, advances: Repository<EmployeeAdvanceEntity>, shifts: Repository<ShiftAssignmentEntity>, assets: Repository<AssetEntity>, assetIssues: Repository<AssetIssueEntity>, units: Repository<AccommodationUnitEntity>, beds: Repository<BedAllocationEntity>, complaints: Repository<AccommodationIssueEntity>, routes: Repository<TransportRouteEntity>, riders: Repository<TransportAssignmentEntity>, payslips: Repository<PayslipEntity>, runs: Repository<PayrollRunEntity>, setup: PayrollSetupService, access: ManpowerAccess);
    status(): Promise<{
        loaded: boolean;
        employees: number;
        contractors: number;
    }>;
    load(actor: Actor): Promise<{
        projectsUsed: number;
        loaded: boolean;
        employees: number;
        contractors: number;
    }>;
    remove(actor: Actor): Promise<{
        loaded: boolean;
        employees: number;
        contractors: number;
    }>;
}
