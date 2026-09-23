import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/employee.dto';
export declare class EmployeesController {
    private readonly service;
    constructor(service: EmployeesService);
    findAll(): Promise<import("../database/entities").EmployeeEntity[]>;
    findOne(id: string): Promise<import("../database/entities").EmployeeEntity>;
    create(dto: CreateEmployeeDto): Promise<import("../database/entities").EmployeeEntity>;
    update(id: string, dto: Partial<CreateEmployeeDto>): Promise<import("../database/entities").EmployeeEntity>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
