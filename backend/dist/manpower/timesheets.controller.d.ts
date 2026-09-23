import { TimesheetsService } from './timesheets.service';
export declare class TimesheetsController {
    private readonly service;
    constructor(service: TimesheetsService);
    forEmployee(employeeId: string, from: string, to: string): Promise<{
        rows: {
            date: string;
            projectId: number;
            projectName: string;
            csiCodeId: string;
            hours: number;
            taskDetail: string;
            status: string;
        }[];
        totalHours: number;
    }>;
}
