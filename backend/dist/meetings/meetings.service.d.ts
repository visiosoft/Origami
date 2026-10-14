import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ChangeOrderEntity, MeetingEntity, RfiEntity, TaskEntity } from '../database/entities';
import { TasksService } from '../tasks/tasks.service';
import type { MeetingActionDto, MeetingDto } from './dto';
type Actor = {
    name: string;
    id?: string;
};
export declare const FOR_RECORD_TOPICS: string[];
export declare class MeetingsService implements OnApplicationBootstrap {
    private readonly repo;
    private readonly tasksRepo;
    private readonly tasks;
    private readonly rfis?;
    private readonly cos?;
    private readonly log;
    constructor(repo: Repository<MeetingEntity>, tasksRepo: Repository<TaskEntity>, tasks: TasksService, rfis?: Repository<RfiEntity> | undefined, cos?: Repository<ChangeOrderEntity> | undefined);
    onApplicationBootstrap(): Promise<void>;
    migrateStatuses(): Promise<number>;
    list(): Promise<MeetingEntity[]>;
    get(id: string): Promise<MeetingEntity>;
    private load;
    create(dto: MeetingDto, actor: Actor): Promise<MeetingEntity>;
    update(id: string, dto: MeetingDto, actor?: Actor): Promise<MeetingEntity>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    addAction(id: string, dto: MeetingActionDto, actor: Actor): Promise<TaskEntity>;
    settle(rows: MeetingEntity[]): Promise<MeetingEntity[]>;
}
export {};
