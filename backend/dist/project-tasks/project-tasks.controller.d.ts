import { ProjectTasksService } from './project-tasks.service';
import { CreateProjectTaskDto } from './dto/create-project-task.dto';
export declare class ProjectTasksController {
    private readonly service;
    constructor(service: ProjectTasksService);
    findAll(projectId?: string): Promise<any[]>;
    board(projectId: string): Promise<{
        sections: import("../seed-data/project-tasks").ProjectSection[];
        tasks: any[];
    }> | {
        sections: never[];
        tasks: never[];
    };
    create(dto: CreateProjectTaskDto): Promise<import("../database/entities").ProjectTaskEntity>;
    update(id: string, dto: Partial<CreateProjectTaskDto>): Promise<import("../database/entities").ProjectTaskEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
