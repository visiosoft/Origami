export declare class ProjectEntity {
    id: number;
    priority: string;
    name: string;
    location: string;
    typeOfWork: string;
    contractType: string;
    contractAmt: string;
    estStart: string;
    duration: string;
    scope: string;
    stage: string;
    progress: number;
    referral: string;
    contactedBy: string;
    imgColor: string;
    img: string;
}
export declare class PersonEntity {
    id: number;
    name: string;
    role: string;
    company: string;
    contact: string | null;
    kind: string;
    tier: string;
    phone: string;
    email: string;
    projects: string[];
    openTasks: number;
    since: string;
    comply: unknown;
    last: string;
}
export declare class TaskEntity {
    id: string;
    tab: string;
    meetingType: string;
    meetingDate: string;
    assignedTo: string;
    status: string;
    originator: string;
    topicType: string;
    description: string;
    dueDate: string;
    dateClosed: string;
    daysOpen: number;
    resolution: string;
    linkedFile: string;
    project: string;
}
export declare class DealEntity {
    id: string;
    name: string;
    client: string;
    value: string;
    stage: string;
    stageIdx: number;
    assignedRole: string;
    assignee: string;
    assigneeInit: string;
    daysInStage: number;
    nextAction: string;
    nextDue: string;
    source: string;
    status: string;
    phone: string;
    email: string;
    timeline: unknown[];
    notes: string;
}
export declare class InvoiceEntity {
    pk: number;
    invId: string;
    kind: string;
    project: string;
    month: string;
    issued: string;
    amount: number;
    paid: number;
}
export declare class FinanceEntity {
    name: string;
    exec: string;
    contract: string;
    labor: string;
    phase: string;
    base: number;
    co: number;
    reimb: number;
    baseUsed: number;
    coUsed: number;
    reimbUsed: number;
    timePct: number;
}
export declare class LeadEntity {
    id: string;
    leadName: string;
    namePronunciation: string;
    phone: string;
    email: string;
    primaryPointOfContact: string;
    secondPointOfContact: string;
    nameOfSecondContact: string;
    phoneOfSecondContact: string;
    emailOfSecondContact: string;
    relationshipOfSecondContact: string;
    decisionMakers: string;
    preferredContactMethod: string;
    leadSource: string;
    projectStreetAddress: string;
    projectStreetName: string;
    projectCity: string;
    projectZipCode: string;
    countyLocation: string;
    propertyType: string;
    potentialProjectType: string;
    homeworkCompleted: string[];
    projectVision: string;
    reasonForProject: string;
    budgetPosition: string;
    fundingStatus: string;
    desiredStart: string;
    expectedDuration: string;
    expectedLengthOfOwnership: string;
    clientPersonality: string;
    virtualMeetingAt: string;
    siteVisitAt: string;
    fitScore: number;
    fitSelections: Record<string, string>;
    createdAt: string;
}
export declare class ScoringCriterionEntity {
    key: string;
    order: number;
    name: string;
    subCriteria: string;
    maxPoints: number;
    options: {
        label: string;
        points: number;
    }[];
}
