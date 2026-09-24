import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ContractorEntity, EmployeeEntity, PersonEntity } from '../database/entities';
import { SettingsService } from '../settings/settings.service';
export declare function splitName(name: string): {
    firstName: string;
    lastName: string;
};
export declare function personFieldsFor(e: Pick<EmployeeEntity, 'name' | 'email' | 'phone' | 'designation' | 'jobTitle' | 'trade' | 'contractorId' | 'employmentType'>, company: string): {
    email: string;
    phone: string;
    role: string;
    company: string;
    kind: string;
    firstName: string;
    lastName: string;
    name: string;
};
export declare class StaffDirectorySync implements OnApplicationBootstrap {
    private readonly employees;
    private readonly people;
    private readonly contractors;
    private readonly settings;
    private readonly log;
    constructor(employees: Repository<EmployeeEntity>, people: Repository<PersonEntity>, contractors: Repository<ContractorEntity>, settings: SettingsService);
    onApplicationBootstrap(): Promise<void>;
    private companyFor;
    private nextPersonId;
    syncEmployee(e: EmployeeEntity, candidates?: PersonEntity[]): Promise<PersonEntity>;
    employeeForPerson(p: PersonEntity): Promise<EmployeeEntity>;
    personChanged(p: PersonEntity, dto: Record<string, any>): Promise<void>;
    removeEmployee(employeeId: string): Promise<void>;
    backfill(): Promise<void>;
}
