export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export interface Attachment {
    name: string;
    url: string;
}
export interface TaskComment {
    id: string;
    author: string;
    text: string;
    date: string;
}
export interface ProjectSection {
    id: string;
    projectId: number;
    name: string;
    order: number;
}
export interface ProjectTask {
    id: string;
    projectId: number;
    sectionId: string;
    title: string;
    description?: string;
    assignee?: string;
    dueDate?: string;
    priority?: Priority;
    order: number;
    completed: boolean;
    parentId?: string | null;
    attachments?: Attachment[];
    comments?: TaskComment[];
    createdAt: string;
}
export declare const DEFAULT_SECTION_NAMES: string[];
export declare const sectionId: (projectId: number, idx: number) => string;
export declare const defaultSectionsFor: (projectId: number) => ProjectSection[];
export declare const DEFAULT_SECTIONS: ProjectSection[];
export declare const DEFAULT_TASKS: ProjectTask[];
