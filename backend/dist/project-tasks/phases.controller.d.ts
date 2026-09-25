import { PhasesService } from './phases.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { ProjectAccessService } from '../auth/project-access.service';
import type { SessionClaims } from '../auth/crypto.util';
export declare class PhasesController {
    private readonly service;
    private readonly access;
    constructor(service: PhasesService, access: ProjectAccessService);
    findAll(projectId: string, claims: SessionClaims | null): Promise<import("../database/entities").ProjectPhaseEntity[]>;
    listTemplates(): Promise<import("../seed-data/programme-template").ProgrammeTemplateDef[]>;
    saveTemplate(body: {
        key?: string;
        name: string;
        phases: unknown;
        projectTypes?: unknown;
        category?: unknown;
    }): Promise<import("../seed-data/programme-template").ProgrammeTemplateDef>;
    deleteTemplate(key: string): Promise<import("../seed-data/programme-template").ProgrammeTemplateDef[]>;
    applyTemplate(projectId: string): Promise<{
        phasesAdded: number;
        tasksAdded: number;
        tasksEnriched: number;
        phasesNotInTemplate: string[];
    }>;
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
        templateCategory: import("../seed-data/programme-template").TemplateCategory;
        designPhase: string | null;
        currentPhaseKey: string;
        phases: {
            id: string;
            key: string;
            name: string;
            color: string;
            order: number;
            category: import("../seed-data/programme-template").PhaseCategory;
            total: number;
            done: number;
            progress: number;
            complete: boolean;
        }[];
        taskTotal: number;
        taskDone: number;
        progress: number;
    }[]>;
    board(projectId: string, claims: SessionClaims | null): Promise<{
        phases: {
            category: import("../seed-data/programme-template").PhaseCategory;
            gated: boolean;
            dependsOn: string[];
            weeks: number;
            id: string;
            projectId: number;
            key: string;
            name: string;
            color: string;
            order: number;
            startDate: string;
            endDate: string;
            seededAt: string;
            notified50: string;
            notified90: string;
            notified100: string;
            hiddenAt: string;
        }[];
        tasks: {
            targetDays: number;
            targetDerived: boolean;
            id: string;
            projectId: number | null;
            sectionId: string;
            title: string;
            description: string;
            assignee: string;
            dueDate: string;
            priority: string;
            order: number;
            completed: boolean;
            parentId: string;
            attachments: import("../database/task.types").TaskAttachment[];
            comments: import("../database/task.types").TaskComment[];
            createdAt: string;
            assigneeId: string;
            collaborators: {
                id: string;
                name: string;
            }[];
            status: string;
            checklist: import("../database/task.types").ChecklistItem[];
            labels: string[];
            activity: import("../database/task.types").ActivityEvent[];
            updatedAt: string;
            phaseId: string;
            team: string;
            auto: boolean;
            autoLabel: string;
            startDate: string;
            endDate: string;
            durationDays: number;
            dependsOn: string[];
        }[];
    }>;
    create(dto: CreatePhaseDto): Promise<import("../database/entities").ProjectPhaseEntity>;
    adopt(body: {
        projectId: number;
        key: string;
    }): Promise<import("../database/entities").ProjectPhaseEntity>;
    update(id: string, dto: Partial<CreatePhaseDto>): Promise<import("../database/entities").ProjectPhaseEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
