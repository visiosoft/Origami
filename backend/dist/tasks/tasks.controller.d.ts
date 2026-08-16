import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    findAll(tab?: string, project?: string): Promise<import("../database/entities").TaskEntity[]>;
    findOne(id: string): Promise<import("../database/entities").TaskEntity>;
    create(dto: CreateTaskDto): Promise<import("../database/entities").TaskEntity>;
}
