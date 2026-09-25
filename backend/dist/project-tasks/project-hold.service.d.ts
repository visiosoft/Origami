import { Repository } from 'typeorm';
import { ProjectEntity, ProjectTaskEntity, UserEntity } from '../database/entities';
import type { UploadActor } from '../google/attachments.service';
import { ProjectTasksService } from './project-tasks.service';
export declare const HOLD_TASK_LABEL = "kind:hold-follow-up";
export interface HoldInput {
    until: string;
    reason?: string;
    followUpId?: string;
}
export declare const holdDate: (d: string) => string;
export declare function holdTaskText(project: {
    name: string;
}, input: {
    until: string;
    reason?: string;
}, since: string, by: string): {
    title: string;
    description: string;
};
export declare class ProjectHoldService {
    private readonly projects;
    private readonly taskRepo;
    private readonly users;
    private readonly tasks;
    constructor(projects: Repository<ProjectEntity>, taskRepo: Repository<ProjectTaskEntity>, users: Repository<UserEntity>, tasks: ProjectTasksService);
    private project;
    hold(projectId: number, input: HoldInput, actor: UploadActor): Promise<ProjectEntity>;
    resume(projectId: number, actor: UploadActor): Promise<ProjectEntity>;
}
