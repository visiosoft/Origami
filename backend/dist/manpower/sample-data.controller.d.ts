import { ManpowerAccess } from './manpower-access.service';
import { SampleDataService } from './sample-data.service';
export declare class SampleDataController {
    private readonly service;
    private readonly access;
    constructor(service: SampleDataService, access: ManpowerAccess);
    status(): Promise<{
        loaded: boolean;
        employees: number;
        contractors: number;
        payrollRuns: number;
    }>;
    load(a?: string): Promise<{
        projectsUsed: number;
        loaded: boolean;
        employees: number;
        contractors: number;
        payrollRuns: number;
    }>;
    payroll(a?: string): Promise<{
        loaded: boolean;
        employees: number;
        contractors: number;
        payrollRuns: number;
    }>;
    remove(a?: string): Promise<{
        loaded: boolean;
        employees: number;
        contractors: number;
        payrollRuns: number;
    }>;
}
