import { ProjectProgramService } from './project-program.service';
export declare class ProjectProgramController {
    private readonly service;
    constructor(service: ProjectProgramService);
    get(projectId: string): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
    }>;
    save(body: {
        projectId: number;
        data: unknown;
    }, req: any): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
    }>;
    complete(body: {
        projectId: number;
        complete?: boolean;
    }): Promise<{
        projectId: number;
        data: Record<string, any>;
        updatedAt: string;
        updatedBy: string;
        completedAt: string;
    }>;
}
