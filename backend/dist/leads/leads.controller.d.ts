import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
export declare class LeadsController {
    private readonly leadsService;
    constructor(leadsService: LeadsService);
    findAll(): never[] | Promise<import("../database/entities").LeadEntity[]>;
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
    findOne(id: string): Promise<import("../database/entities").LeadEntity>;
    create(dto: CreateLeadDto): Promise<import("../database/entities").LeadEntity>;
    update(id: string, dto: Partial<CreateLeadDto>): Promise<import("../database/entities").LeadEntity>;
    remove(id: string): Promise<import("../database/entities").LeadEntity>;
}
