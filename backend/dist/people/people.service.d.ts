import { Repository } from 'typeorm';
import { PersonEntity } from '../database/entities';
export declare class PeopleService {
    private readonly repo?;
    private mem;
    constructor(repo?: Repository<PersonEntity> | undefined);
    findAll(project?: string): Promise<any[]>;
    findOne(id: string): Promise<any>;
    create(dto: any): any;
}
