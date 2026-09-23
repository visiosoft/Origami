export declare class LaborLogEntryDto {
    id?: string;
    employeeId: string;
    csiCodeId?: string;
    hours?: number;
    taskDetail?: string;
    taskStatus?: string;
    team?: string;
}
export declare class SaveDailyLogDto {
    projectId: number;
    date: string;
    notes?: string;
    entries?: LaborLogEntryDto[];
}
export declare class RejectDailyLogDto {
    note?: string;
}
