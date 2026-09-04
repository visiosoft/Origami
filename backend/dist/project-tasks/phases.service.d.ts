import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProjectPhaseEntity, ProjectTaskEntity, ProjectEntity } from '../database/entities';
import { type TemplatePhase } from '../seed-data/programme-template';
import { SettingsService } from '../settings/settings.service';
import { SectionsService } from './sections.service';
export declare class PhasesService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly tasks;
    private readonly projects;
    private readonly sections;
    private readonly settings;
    private readonly log;
    constructor(repo: Repository<ProjectPhaseEntity>, tasks: Repository<ProjectTaskEntity>, projects: Repository<ProjectEntity>, sections: SectionsService, settings: SettingsService);
    private programme;
    applyTemplate(projectId: number): Promise<{
        phasesAdded: number;
        tasksAdded: number;
        phasesNotInTemplate: string[];
    }>;
    getTemplate(): Promise<TemplatePhase[]>;
    saveTemplate(body: unknown): Promise<TemplatePhase[]>;
    onApplicationBootstrap(): Promise<void>;
    private seedChecklists;
    overview(): Promise<{
        projectId: number;
        name: string;
        stage: string;
        priority: string;
        contractAmt: string;
        location: string;
        typeOfWork: string;
        imgColor: string;
        contractType: string;
        estStart: string;
        duration: string;
        scope: string;
        referral: string;
        projectProgress: number;
        designPhase: string | null;
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
