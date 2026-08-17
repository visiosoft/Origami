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
    leadId: string;
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
    zoningImages: string;
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
export declare class RoleEntity {
    key: string;
    name: string;
    description: string;
    tier: string;
    order: number;
    isSystem: boolean;
    permissions: Record<string, {
        view: boolean;
        manage: boolean;
    }>;
}
export declare class TicketEntity {
    id: string;
    subject: string;
    category: string;
    priority: string;
    message: string;
    requesterName: string;
    requesterEmail: string;
    status: string;
    createdAt: string;
}
export declare class FaqEntity {
    id: string;
    question: string;
    answer: string;
    category: string;
    order: number;
}
export declare class EmailTemplateEntity {
    id: string;
    key: string;
    name: string;
    subject: string;
    body: string;
    kind: string;
    category: string;
    updatedAt: string;
}
export declare class WorkflowEntity {
    id: string;
    projectId: number;
    name: string;
    description: string;
    status: string;
    owner: string;
    estimatedDays: number;
    plannedStart: string;
    plannedEnd: string;
    completedAt: string;
    createdAt: string;
}
export declare class WorkflowItemEntity {
    id: string;
    workflowId: string;
    title: string;
    status: string;
    notes: string;
    order: number;
    estimatedDays: number;
    plannedStart: string;
    plannedEnd: string;
    completedAt: string;
    createdAt: string;
}
export declare class ProjectSectionEntity {
    id: string;
    projectId: number;
    name: string;
    order: number;
}
export declare class ProjectTaskEntity {
    id: string;
    projectId: number;
    sectionId: string;
    title: string;
    description: string;
    assignee: string;
    dueDate: string;
    priority: string;
    order: number;
    completed: boolean;
    parentId: string;
    attachments: {
        name: string;
        url: string;
    }[];
    comments: {
        id: string;
        author: string;
        text: string;
        date: string;
    }[];
    createdAt: string;
}
export declare class UserEntity {
    id: string;
    name: string;
    email: string;
    tier: string;
    roleKey: string;
    status: string;
    lastLogin: string;
    createdAt: string;
}
