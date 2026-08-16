export declare class CreateWorkflowDto {
    id?: string;
    projectId?: number | null;
    name: string;
    description?: string;
    status?: string;
    owner?: string;
    estimatedDays?: number | null;
    plannedStart?: string;
    plannedEnd?: string;
    completedAt?: string;
}
