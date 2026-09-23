import { Repository } from 'typeorm';
import { EmployeeEntity } from '../database/entities';
export declare class EmployeesService {
    private readonly repo;
    constructor(repo: Repository<EmployeeEntity>);
    findAll(): Promise<EmployeeEntity[]>;
    findOne(id: string): Promise<EmployeeEntity>;
    create(dto: any): Promise<EmployeeEntity>;
    update(id: string, dto: any): Promise<EmployeeEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
