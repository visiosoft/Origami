import { PhasesService } from './phases.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
export declare class PhasesController {
    private readonly service;
    constructor(service: PhasesService);
    findAll(projectId: string): Promise<import("../database/entities").ProjectPhaseEntity[]>;
    getTemplate(): Promise<import("../seed-data/programme-template").TemplatePhase[]>;
    saveTemplate(body: unknown): Promise<import("../seed-data/programme-template").TemplatePhase[]>;
    resetTemplate(): Promise<import("../seed-data/programme-template").TemplatePhase[]>;
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
    board(projectId: string): Promise<{
        phases: {
            gated: boolean;
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
            notified50: string | null;
            notified90: string | null;
            notified100: string | null;
        }[];
        tasks: {
            targetDays: number;
            targetDerived: boolean;
            id: string;
            projectId: number;
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
    }> | {
        phases: never[];
        tasks: never[];
    };
    create(dto: CreatePhaseDto): Promise<import("../database/entities").ProjectPhaseEntity>;
    update(id: string, dto: Partial<CreatePhaseDto>): Promise<import("../database/entities").ProjectPhaseEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
