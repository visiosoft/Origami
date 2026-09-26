import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ContractorEntity, EmployeeEntity, PersonEntity } from '../database/entities';
export declare const isSubCompany: (p: Pick<PersonEntity, "kind" | "employeeId">) => boolean;
export declare class ContractorDirectorySync implements OnApplicationBootstrap {
    private readonly people;
    private readonly contractors;
    private readonly employees;
    private readonly log;
    constructor(people: Repository<PersonEntity>, contractors: Repository<ContractorEntity>, employees: Repository<EmployeeEntity>);
    private nextPersonId;
    syncContractor(c: ContractorEntity, candidates?: PersonEntity[]): Promise<PersonEntity>;
    contractorForPerson(p: PersonEntity): Promise<ContractorEntity | null>;
    personChanged(p: PersonEntity, dto: Record<string, unknown>): Promise<void>;
    removeForPerson(p: PersonEntity): Promise<void>;
    removeContractor(contractorId: string): Promise<void>;
    backfill(): Promise<void>;
    onApplicationBootstrap(): Promise<void>;
}
