import { Repository } from 'typeorm';
import { LeadEntity } from '../database/entities';
export declare class LeadsService {
    private readonly repo?;
    constructor(repo?: Repository<LeadEntity> | undefined);
    getOptions(): {
        primaryPointOfContact: string[];
        secondPointOfContact: string[];
        relationshipOfSecondContact: string[];
        decisionMakers: string[];
        preferredContactMethod: string[];
        leadSource: string[];
        projectCity: string[];
        countyLocation: string[];
        propertyType: string[];
        potentialProjectType: string[];
        homeworkCompleted: string[];
        reasonForProject: string[];
        budgetPosition: string[];
        fundingStatus: string[];
        desiredStart: string[];
        expectedDuration: string[];
        expectedLengthOfOwnership: string[];
        clientPersonality: string[];
    };
    findAll(): never[] | Promise<LeadEntity[]>;
    findOne(id: string): Promise<LeadEntity>;
    create(dto: any): any;
    update(id: string, dto: any): Promise<any>;
    remove(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
}
