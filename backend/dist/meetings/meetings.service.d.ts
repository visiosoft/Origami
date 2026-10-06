import { Repository } from 'typeorm';
import { MeetingEntity, TaskEntity } from '../database/entities';
import { TasksService } from '../tasks/tasks.service';
import type { MeetingActionDto, MeetingDto } from './dto';
type Actor = {
    name: string;
    id?: string;
};
export declare class MeetingsService {
    private readonly repo;
    private readonly tasksRepo;
    private readonly tasks;
    constructor(repo: Repository<MeetingEntity>, tasksRepo: Repository<TaskEntity>, tasks: TasksService);
    list(): Promise<MeetingEntity[]>;
    get(id: string): Promise<MeetingEntity>;
    create(dto: MeetingDto, actor: Actor): Promise<MeetingEntity>;
    update(id: string, dto: MeetingDto): Promise<MeetingEntity>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    addAction(id: string, dto: MeetingActionDto, actor: Actor): Promise<TaskEntity>;
}
export {};
