import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
export declare class TasksController {
    private readonly tasksService;
    constructor(tasksService: TasksService);
    findAll(tab?: string, project?: string): any[] | Promise<import("../database/entities").TaskEntity[]>;
    findOne(id: string): Promise<any>;
    create(dto: CreateTaskDto): any;
}
