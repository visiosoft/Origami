import type { TaskAttachment, TaskComment, ChecklistItem, ActivityEvent } from './task.types';
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
    designPhase: string;
    leadId: string;
    introLetterSentAt: string;
    introLetterSubject: string;
    introLetterHtml: string;
    contractApproved: boolean | null;
    templateKey: string;
    website: string;
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
    firstName: string;
    lastName: string;
    goByName: string;
    pronouns: string;
    gender: string;
    categories: string[];
    addresses: Record<string, unknown>;
    contactInfo: Record<string, unknown>;
    licenses: unknown[];
    insurance: Record<string, unknown>;
    notLicensedDesigner: boolean | null;
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
    dueTime: string;
    dateClosed: string;
    daysOpen: number;
    resolution: string;
    linkedFile: string;
    project: string;
    assignedToId: string;
    attachments: TaskAttachment[];
    comments: TaskComment[];
    activity: ActivityEvent[];
    checklist: ChecklistItem[];
    labels: string[];
    updatedAt: string;
}
export declare class DealEntity {
    id: string;
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
    timeline: unknown[];
    notes: string;
    stageEnteredAt: string;
    holdUntil: string;
    archived: boolean | null;
    archivedAt: string;
    convertedProjectId: number | null;
    roles: Record<string, string>;
    followUps: unknown[];
    stageNotes: unknown[];
    rejectionType: string;
    rejectionReason: string;
    referredToName: string;
    referredToCompany: string;
    referredToContact: string;
}
export declare class ProposalEntity {
    dealId: string;
    subject: string;
    html: string;
    amount: string;
    updatedAt: string;
    updatedBy: string;
    sentAt: string;
    sentTo: string;
    signedAt: string;
    signedByName: string;
    signedByEmail: string;
    signatureImage: string;
    signerIp: string;
    signerUserAgent: string;
    reviewedAllPages: boolean | null;
    requiresSecondSignatory: boolean | null;
    signedAt2: string;
    signedByName2: string;
    signedByEmail2: string;
    signatureImage2: string;
    signerIp2: string;
    signerUserAgent2: string;
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
    businessName: string;
    firstName: string;
    lastName: string;
    goByName: string;
    pronouns: string;
    namePronunciation: string;
    phone: string;
    email: string;
    primaryPointOfContact: string;
    secondPointOfContact: string;
    nameOfSecondContact: string;
    phoneOfSecondContact: string;
    emailOfSecondContact: string;
    relationshipOfSecondContact: string;
    preferredContactMethodOfSecondContact: string;
    pronounsOfSecondContact: string;
    additionalContacts: unknown[];
    primaryContactRoles: string[];
    sectionNotes: Record<string, string>;
    sectionCustomFields: Record<string, unknown[]>;
    contacts: unknown[];
    decisionMakers: string;
    preferredContactMethod: string;
    preferredContactMatrix: Record<string, string>;
    leadSource: string;
    leadSourceReferrerName: string;
    leadSourceReferrerPhone: string;
    leadSourceEventDetail: string;
    projectStreetAddress: string;
    projectStreetName: string;
    projectAddress2: string;
    occupancyStatus: string;
    projectCity: string;
    projectZipCode: string;
    countyLocation: string;
    hasHOA: string;
    addresses: Record<string, unknown>;
    propertyType: string;
    potentialProjectType: string;
    contractType: string;
    otherDetails: Record<string, string>;
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
    meetingType: string;
    meetingAgenda: string;
    meetingEventId: string;
    fitScore: number;
    fitSelections: Record<string, string>;
    zoningImages: string;
    zoningAnalysis: string;
    website: string;
    updatedAt: string;
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
export declare class ConsultantEntity {
    id: string;
    type: string;
    firm: string;
    address: string;
    contact: string;
    phone: string;
    email: string;
    rfpSent: boolean;
    bidInterest: boolean;
    proposalAmount: string;
    signedContract: boolean;
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
    projectId: number | null;
    name: string;
    order: number;
}
export declare class ProjectTaskEntity {
    id: string;
    projectId: number | null;
    sectionId: string;
    title: string;
    description: string;
    assignee: string;
    dueDate: string;
    priority: string;
    order: number;
    completed: boolean;
    parentId: string;
    attachments: TaskAttachment[];
    comments: TaskComment[];
    createdAt: string;
    assigneeId: string;
    status: string;
    checklist: ChecklistItem[];
    labels: string[];
    activity: ActivityEvent[];
    updatedAt: string;
    phaseId: string;
    team: string;
    auto: boolean;
    autoLabel: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    dependsOn: string[];
}
export declare class ProjectPhaseEntity {
    id: string;
    projectId: number;
    key: string;
    name: string;
    color: string;
    order: number;
    startDate: string;
    endDate: string;
    seededAt: string;
    notified50: string;
    notified90: string;
    notified100: string;
}
export declare class ProjectProgramEntity {
    projectId: number;
    data: string;
    updatedAt: string;
    updatedBy: string;
    completedAt: string;
    sentAt: string;
    sentTo: string;
    signedAt: string;
    signedByName: string;
    signedByEmail: string;
    signatureImage: string;
    signerIp: string;
    signerUserAgent: string;
}
export declare class LeadProgramEntity {
    leadId: string;
    data: string;
    updatedAt: string;
    updatedBy: string;
    completedAt: string;
    sentAt: string;
    sentTo: string;
}
export declare class GuestAccessEntity {
    id: number;
    userId: string;
    projectId: number;
    createdAt: string;
    expiresAt: string;
    createdBy: string;
    revokedAt: string;
    lastUsedAt: string;
}
export declare class ProjectProgramVersionEntity {
    id: number;
    ownerKey: string;
    data: string;
    savedAt: string;
    savedBy: string;
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
    passwordHash: string;
    passwordSetAt: string;
    googleId: string;
    avatarUrl: string;
    inviteToken: string;
    inviteSentAt: string;
    inviteExpiresAt: string;
    notifyOnAssignment: boolean | null;
    notifyByEmail: boolean | null;
    notifyBySms: boolean | null;
    digestFrequency: string;
    notifyOnOverdue: boolean | null;
    notifyOnMilestone: boolean | null;
    calendarRefreshToken: string;
    calendarEmail: string;
    calendarConnectedAt: string;
}
export declare class AppSettingEntity {
    key: string;
    value: string;
    updatedAt: string;
}
export declare class FileRoomFileEntity {
    id: string;
    projectId: number;
    folderPath: string[];
    name: string;
    ext: string;
    size: number;
    mimeType: string;
    driveId: string;
    uploadedBy: string;
    uploadedById: string;
    updatedAt: string;
    groupId: string;
    isLatest: boolean;
    notes: string;
}
export declare class FileRoomFolderEntity {
    id: string;
    projectId: number;
    path: string[];
    name: string;
    createdAt: string;
}
export declare class EmployeeEntity {
    id: string;
    name: string;
    jobTitle: string;
    trade: string;
    expertise: string[];
    payType: string;
    payRate: number;
    phone: string;
    email: string;
    hireDate: string;
    status: string;
    supervisorId: string;
    userId: string;
    createdAt: string;
    workerId: string;
    fatherOrSpouseName: string;
    nationalId: string;
    dob: string;
    gender: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelation: string;
    permanentAddress: string;
    currentAddress: string;
    photo: TaskAttachment | null;
    employmentType: string;
    department: string;
    designation: string;
    grade: string;
    employmentStatus: string;
    hrOfficerId: string;
    bankName: string;
    bankAccount: string;
    taxNumber: string;
    tradeId: string;
    skillLevel: string;
    yearsExperience: number;
    equipmentCapabilities: string[];
    updatedAt: string;
}
export declare class TradeEntity {
    id: string;
    name: string;
    active: boolean;
    order: number;
}
export declare class EmployeeRecordEntity {
    id: string;
    employeeId: string;
    kind: string;
    type: string;
    title: string;
    number: string;
    issuer: string;
    issueDate: string;
    expiryDate: string;
    rate: number;
    terms: string;
    verification: string;
    status: string;
    notes: string;
    attachments: TaskAttachment[];
    createdAt: string;
    updatedAt: string;
}
export declare class CsiCodeEntity {
    id: string;
    code: string;
    division: string;
    description: string;
    active: boolean;
    order: number;
}
export declare class DailyLogEntity {
    id: string;
    projectId: number;
    date: string;
    supervisorId: string;
    supervisorName: string;
    notes: string;
    status: string;
    submittedAt: string;
    approvedById: string;
    approvedByName: string;
    approvedAt: string;
    rejectionNote: string;
    createdAt: string;
}
export declare class LaborLogEntryEntity {
    id: string;
    dailyLogId: string;
    employeeId: string;
    csiCodeId: string;
    hours: number;
    taskDetail: string;
    taskStatus: string;
    team: string;
}
export declare class LeaveRequestEntity {
    id: string;
    employeeId: string;
    type: string;
    startDate: string;
    endDate: string;
    hours: number;
    reason: string;
    status: string;
    requestedBy: string;
    requestedAt: string;
    decidedBy: string;
    decidedAt: string;
    note: string;
}
