import { Repository } from 'typeorm';
import { FileRoomFileEntity, LeadEntity, LeadFilesEntity, ProjectEntity, ProjectPhaseEntity, ProjectTaskEntity, RfiEntity, TaskEntity } from '../database/entities';
export type FileSource = 'lead' | 'client' | 'lead-task' | 'project-task' | 'rfi' | 'file-room';
export interface IndexedFile {
    n: number;
    id: string;
    name: string;
    kind: string;
    mimeType?: string;
    size?: number;
    uploadedAt?: string;
    uploadedBy?: string;
    source: FileSource;
    where: string;
    taskNumber?: string;
    scope: 'lead-files' | 'tasks' | 'project-tasks' | 'rfis' | 'file-room';
    ownerId: string;
    url?: string;
}
export declare class AllFilesService {
    private readonly leadFiles;
    private readonly leads;
    private readonly logTasks;
    private readonly projects;
    private readonly boardTasks;
    private readonly phases;
    private readonly rfis;
    private readonly fileRoom;
    constructor(leadFiles: Repository<LeadFilesEntity>, leads: Repository<LeadEntity>, logTasks: Repository<TaskEntity>, projects: Repository<ProjectEntity>, boardTasks: Repository<ProjectTaskEntity>, phases: Repository<ProjectPhaseEntity>, rfis: Repository<RfiEntity>, fileRoom: Repository<FileRoomFileEntity>);
    forLead(leadId: string): Promise<{
        leadId: string | null;
        projectId: number | null;
        projectName: string;
        files: {
            n: number;
            id: string;
            name: string;
            scope: "lead-files" | "tasks" | "project-tasks" | "rfis" | "file-room";
            kind: string;
            source: FileSource;
            size?: number | undefined;
            mimeType?: string | undefined;
            uploadedBy?: string | undefined;
            where: string;
            ownerId: string;
            url?: string | undefined;
            uploadedAt?: string | undefined;
            taskNumber?: string | undefined;
        }[];
    }>;
    forProject(projectId: number): Promise<{
        leadId: string | null;
        projectId: number | null;
        projectName: string;
        files: {
            n: number;
            id: string;
            name: string;
            scope: "lead-files" | "tasks" | "project-tasks" | "rfis" | "file-room";
            kind: string;
            source: FileSource;
            size?: number | undefined;
            mimeType?: string | undefined;
            uploadedBy?: string | undefined;
            where: string;
            ownerId: string;
            url?: string | undefined;
            uploadedAt?: string | undefined;
            taskNumber?: string | undefined;
        }[];
    }>;
    private collect;
}
