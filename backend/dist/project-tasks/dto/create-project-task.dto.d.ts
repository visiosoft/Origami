export declare class CreateProjectTaskDto {
    id?: string;
    projectId: number;
    sectionId?: string;
    title: string;
    description?: string;
    assignee?: string;
    dueDate?: string;
    priority?: string;
    order?: number;
    completed?: boolean;
    parentId?: string | null;
    attachments?: {
        name: string;
        url: string;
    }[];
    comments?: {
        id: string;
        author: string;
        text: string;
        date: string;
    }[];
}
