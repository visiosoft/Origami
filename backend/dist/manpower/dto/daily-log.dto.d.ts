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
    id?: string;
    newVersion?: boolean;
    sections?: Record<string, any> | null;
    onBehalfOf?: string;
    certifiedName?: string;
    signatureDataUrl?: string;
    dupBaseline?: Record<string, any> | null;
    dupFromDate?: string;
}
export declare class SaveDailyReportTemplateDto {
    name: string;
    sections?: Record<string, any> | null;
    entries?: Record<string, any>[];
}
export declare class RejectDailyLogDto {
    note?: string;
}
