export declare enum TaskStatus {
    Open = "Open",
    InProgress = "In Progress",
    Closed = "Closed"
}
export declare enum TaskCategory {
    Internal = "internal",
    Owner = "owner",
    Subcontractor = "subcontractor"
}
export declare class CreateTaskDto {
    description: string;
    assignedTo: string;
    originator: string;
    meetingType?: string;
    meetingDate?: string;
    status?: TaskStatus;
    category: TaskCategory;
    project: string;
    topicType?: string;
}
