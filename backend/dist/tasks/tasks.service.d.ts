import { CreateTaskDto } from './dto/create-task.dto';
export interface Task {
    id: string;
    description: string;
    assignedTo: string;
    originator: string;
    meetingType?: string;
    meetingDate: string;
    status: string;
    category: string;
    project: string;
    topicType?: string;
}
export declare class TasksService {
    private taskCounter;
    private tasks;
    findAll(tab?: string, project?: string): Task[];
    findOne(id: string): Task;
    create(dto: CreateTaskDto): Task;
}
