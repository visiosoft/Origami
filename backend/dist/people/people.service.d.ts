import { Repository } from 'typeorm';
import { PersonEntity } from '../database/entities';
export declare class PeopleService {
    private readonly repo;
    constructor(repo: Repository<PersonEntity>);
    findAll(project?: string): Promise<PersonEntity[]>;
    findOne(id: string): Promise<PersonEntity>;
    private nextId;
    create(dto: any): Promise<PersonEntity>;
    update(id: string, dto: any): Promise<PersonEntity>;
    remove(id: string): Promise<{
        id: number;
        deleted: boolean;
    }>;
}
