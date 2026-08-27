import { Repository } from 'typeorm';
import { ProjectPhaseEntity, ProjectTaskEntity, ProjectEntity } from '../database/entities';
import { SectionsService } from './sections.service';
export declare class PhasesService {
    private readonly repo;
    private readonly tasks;
    private readonly projects;
    private readonly sections;
    private readonly log;
    constructor(repo: Repository<ProjectPhaseEntity>, tasks: Repository<ProjectTaskEntity>, projects: Repository<ProjectEntity>, sections: SectionsService);
    overview(): Promise<{
        projectId: number;
        name: string;
        stage: string;
        priority: string;
        contractAmt: string;
        location: string;
        typeOfWork: string;
        imgColor: string;
        currentPhaseKey: string;
        phases: {
            id: string;
            key: string;
            name: string;
            color: string;
            order: number;
            total: number;
            done: number;
            progress: number;
            complete: boolean;
        }[];
        taskTotal: number;
        taskDone: number;
        progress: number;
    }[]>;
    forProject(projectId: number): Promise<ProjectPhaseEntity[]>;
    board(projectId: number): Promise<{
        phases: ProjectPhaseEntity[];
        tasks: ProjectTaskEntity[];
    }>;
    create(dto: any): Promise<ProjectPhaseEntity>;
    update(id: string, dto: any): Promise<ProjectPhaseEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    private seedDemoTasks;
    private stampPhaseDates;
    private projectStart;
    private addDays;
}
