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
    programOff: boolean;
    holdSince: string;
    holdUntil: string;
    holdReason: string;
    holdBy: string;
    holdTaskId: string;
    holdHistory: {
        action: 'hold' | 'changed' | 'resumed';
        at: string;
        by: string;
        until?: string;
        reason?: string;
        followUp?: string;
    }[] | null;
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
    employeeId: string;
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
    collaborators: {
        id: string;
        name: string;
    }[];
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
    clientBackground: {
        facts?: Record<string, string>;
        notes?: {
            id: string;
            text: string;
            at: string;
            by?: string;
        }[];
    };
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
    collaborators: {
        id: string;
        name: string;
    }[];
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
    hiddenAt: string;
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
    bankRoutingNumber: string;
    filingStatus: string;
    taxState: string;
    flsaStatus: string;
    workersCompClass: string;
    tradeId: string;
    skillLevel: string;
    yearsExperience: number;
    equipmentCapabilities: string[];
    updatedAt: string;
    contractorId: string;
    siteAccessStatus: string;
    payComponents: {
        componentId: string;
        value: number;
    }[];
    overtimeRate: number;
}
export declare class PayComponentEntity {
    id: string;
    name: string;
    kind: string;
    calcType: string;
    defaultValue: number;
    appliesTo: string;
    category: string;
    active: boolean;
    order: number;
}
export interface PayLine {
    id: string;
    name: string;
    kind: 'earning' | 'deduction';
    source: string;
    amount: number;
    componentId?: string;
    refIds?: string[];
    note?: string;
}
export declare class PayrollRunEntity {
    id: string;
    label: string;
    periodStart: string;
    periodEnd: string;
    payGroup: string;
    status: string;
    totals: {
        headcount: number;
        gross: number;
        deductions: number;
        net: number;
        paid: number;
    };
    settingsSnapshot: Record<string, unknown>;
    notes: string;
    createdByName: string;
    createdAt: string;
    finalizedByName: string;
    finalizedAt: string;
    voidedByName: string;
    voidedAt: string;
    voidReason: string;
    updatedAt: string;
}
export declare class PayslipEntity {
    id: string;
    runId: string;
    employeeId: string;
    employee: Record<string, unknown>;
    basis: Record<string, unknown>;
    lines: PayLine[];
    gross: number;
    deductions: number;
    net: number;
    paymentStatus: string;
    paidAt: string;
    paymentMethod: string;
    paymentRef: string;
    paidByName: string;
    notes: string;
    updatedAt: string;
}
export declare class OvertimeRequestEntity {
    id: string;
    employeeId: string;
    projectId: number;
    date: string;
    hours: number;
    otType: string;
    rate: number;
    reason: string;
    status: string;
    source: string;
    requestedById: string;
    requestedByName: string;
    decidedByName: string;
    decidedAt: string;
    decisionNote: string;
    baseRate: number;
    multiplier: number;
    amount: number;
    payrollRunId: string;
    createdAt: string;
    updatedAt: string;
}
export interface AdvanceApproval {
    stage: string;
    decision: 'approved' | 'rejected';
    byName: string;
    byId?: string;
    at: string;
    note?: string;
}
export interface AdvanceRepayment {
    id: string;
    date: string;
    amount: number;
    method: 'payroll' | 'manual';
    runId?: string;
    payslipId?: string;
    byName?: string;
    note?: string;
}
export declare class EmployeeAdvanceEntity {
    id: string;
    employeeId: string;
    type: string;
    amount: number;
    requestDate: string;
    reason: string;
    installments: number;
    installmentAmount: number;
    deductionStart: string;
    status: string;
    approvals: AdvanceApproval[];
    disbursedAt: string;
    disbursedByName: string;
    paymentMethod: string;
    paymentRef: string;
    repayments: AdvanceRepayment[];
    recovered: number;
    createdByName: string;
    createdById: string;
    createdAt: string;
    updatedAt: string;
}
export declare class EmployeeAssignmentEntity {
    id: string;
    employeeId: string;
    projectId: number;
    workArea: string;
    tradeId: string;
    designation: string;
    assignmentType: string;
    startDate: string;
    endDate: string;
    status: string;
    endReason: string;
    transferredFromId: string;
    workforceRequestId: string;
    requestLineId: string;
    notes: string;
    createdByName: string;
    endedByName: string;
    createdAt: string;
    updatedAt: string;
}
export interface WorkforceRequestLine {
    id: string;
    tradeId: string;
    designation?: string;
    quantity: number;
}
export declare class WorkforceRequestEntity {
    id: string;
    projectId: number;
    workArea: string;
    requiredDate: string;
    durationDays: number;
    lines: WorkforceRequestLine[];
    notes: string;
    status: string;
    requestedById: string;
    requestedByName: string;
    submittedAt: string;
    decidedByName: string;
    decidedAt: string;
    decisionNote: string;
    createdAt: string;
    updatedAt: string;
}
export declare class ContractorEntity {
    id: string;
    companyName: string;
    personId: number;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    contractNumber: string;
    contractStart: string;
    contractEnd: string;
    scopeOfWork: string;
    agreedRates: string;
    insuranceProvider: string;
    insurancePolicyNumber: string;
    insuranceExpiry: string;
    tradeIds: string[];
    licenseNumber: string;
    licenseExpiry: string;
    status: string;
    notes: string;
    attachments: TaskAttachment[];
    createdAt: string;
    updatedAt: string;
    userId: string;
}
export declare class TimesheetEntity {
    id: string;
    employeeId: string;
    weekStart: string;
    status: string;
    totalHours: number;
    notes: string;
    submittedAt: string;
    submittedById: string;
    submittedByName: string;
    decidedAt: string;
    decidedById: string;
    decidedByName: string;
    decisionNote: string;
    createdAt: string;
    updatedAt: string;
}
export interface TimesheetDay {
    hours: number;
    note?: string;
}
export declare class TimesheetLineEntity {
    id: string;
    timesheetId: string;
    employeeId: string;
    kind: string;
    projectId: number;
    csiCodeId: string;
    category: string;
    leaveTypeId: string;
    description: string;
    days: Record<string, TimesheetDay>;
    leaveRequestIds: string[];
    order: number;
}
export declare class SubcontractorTradeEntity {
    id: string;
    code: string;
    name: string;
    category: string;
    description: string;
    active: boolean;
    order: number;
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
    leaveTypeId: string;
    halfDay: boolean;
    days: number;
    requestedById: string;
    decidedById: string;
}
export declare class LeaveTypeEntity {
    id: string;
    name: string;
    paid: boolean;
    trackBalance: boolean;
    annualDays: number;
    carryForwardMax: number;
    encashable: boolean;
    color: string;
    active: boolean;
    order: number;
}
export declare class LeaveAdjustmentEntity {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    year: number;
    kind: string;
    days: number;
    amount: number;
    payrollRunId: string;
    note: string;
    createdByName: string;
    createdAt: string;
}
export declare class PublicHolidayEntity {
    id: string;
    date: string;
    name: string;
}
export declare class ShiftTemplateEntity {
    id: string;
    name: string;
    code: string;
    kind: string;
    startTime: string;
    endTime: string;
    allowancePerDay: number;
    color: string;
    active: boolean;
    order: number;
}
export declare class ShiftAssignmentEntity {
    id: string;
    employeeId: string;
    templateIds: string[];
    rotateEveryDays: number;
    startDate: string;
    endDate: string;
    notes: string;
    createdByName: string;
    endedByName: string;
    createdAt: string;
}
export declare class AssetEntity {
    id: string;
    assetTag: string;
    name: string;
    category: string;
    serialNumber: string;
    status: string;
    condition: string;
    purchaseDate: string;
    cost: number;
    notes: string;
    createdAt: string;
    updatedAt: string;
}
export declare class AssetIssueEntity {
    id: string;
    assetId: string;
    employeeId: string;
    issuedAt: string;
    expectedReturn: string;
    status: string;
    returnedAt: string;
    returnCondition: string;
    chargeAmount: number;
    replacesIssueId: string;
    notes: string;
    issuedByName: string;
    closedByName: string;
}
export declare class AccommodationUnitEntity {
    id: string;
    parentId: string;
    level: string;
    name: string;
    notes: string;
    active: boolean;
    createdAt: string;
}
export declare class BedAllocationEntity {
    id: string;
    bedId: string;
    employeeId: string;
    checkIn: string;
    checkOut: string;
    notes: string;
    byName: string;
}
export declare class AccommodationIssueEntity {
    id: string;
    unitId: string;
    title: string;
    description: string;
    employeeId: string;
    status: string;
    resolution: string;
    reportedByName: string;
    reportedAt: string;
    resolvedAt: string;
}
export declare class TransportRouteEntity {
    id: string;
    name: string;
    vehicle: string;
    capacity: number;
    driverEmployeeId: string;
    projectId: number;
    departureTime: string;
    returnTime: string;
    pickupPoints: string[];
    status: string;
    notes: string;
    createdAt: string;
}
export declare class TransportAssignmentEntity {
    id: string;
    routeId: string;
    employeeId: string;
    pickupPoint: string;
    startDate: string;
    endDate: string;
    byName: string;
}
declare abstract class FinanceStamped {
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    version: number;
}
export declare class ProjectFinancialEntity extends FinanceStamped {
    projectId: number;
    currency: string;
    fxRate: number;
    originalContractValue: number;
    originalBudget: number | null;
    retentionPct: number;
    taxPct: number;
    paymentTermsDays: number;
    requireProgressApproval: boolean;
    billToName: string;
    billToEmail: string;
    billToAddress: string;
    contractNumber: string;
    poNumber: string;
    notes: string;
    contractLockedAt: string;
    reportedProgress: number;
    approvedProgress: number;
    reimbursableMarkupPct: number;
    laborBurdenPct: number;
}
declare abstract class ItemFinancialBase extends FinanceStamped {
    projectId: number;
    contractValue: number | null;
    budgetedCost: number | null;
    estimatedCost: number | null;
    billingMethod: string;
    retentionPctOverride: number | null;
    taxPctOverride: number | null;
    csiCodeId: string;
    subcontractorTradeId: string;
    deliverables: string;
    requiredFromUs: string;
    requiredFromClient: string;
    requiredFromContractor: string;
    acceptanceCriteria: string;
    billingCondition: string;
    notes: string;
    reportedProgress: number;
    approvedProgress: number;
    progressApprovedBy: string;
    progressApprovedAt: string;
}
export declare class PhaseFinancialEntity extends ItemFinancialBase {
    phaseId: string;
}
export declare class TaskFinancialEntity extends ItemFinancialBase {
    taskId: string;
    phaseId: string;
}
export declare class ProgressUpdateEntity {
    id: string;
    projectId: number;
    targetType: string;
    targetId: string;
    kind: string;
    fromPct: number;
    toPct: number;
    reason: string;
    byName: string;
    byId: string;
    at: string;
}
export declare class ProjectInvoiceEntity extends FinanceStamped {
    id: string;
    issuedNumber: string;
    projectId: number;
    kind: string;
    status: string;
    invoiceDate: string;
    dueDate: string;
    periodStart: string;
    periodEnd: string;
    currency: string;
    fxRate: number;
    baseCurrency: string;
    reference: string;
    poNumber: string;
    description: string;
    billToName: string;
    billToEmail: string;
    billToAddress: string;
    retentionPct: number;
    taxPct: number;
    notes: string;
    attachments: TaskAttachment[];
    contractWork: number | null;
    retentionAmount: number | null;
    adjustmentTotal: number | null;
    taxAmount: number | null;
    total: number | null;
    issuedAt: string;
    issuedById: string;
    issuedByName: string;
    voidedAt: string;
    voidedById: string;
    voidedByName: string;
    voidReason: string;
    creditForInvoiceId: string;
    creditType: string;
    creditReason: string;
    approvalRequestedAt: string;
    approvalRequestedBy: string;
}
export declare class ProjectInvoiceLineEntity {
    id: string;
    invoiceId: string;
    projectId: number;
    kind: string;
    targetType: string;
    phaseId: string;
    taskId: string;
    lineOrder: number;
    description: string;
    billingMethod: string;
    contractValue: number | null;
    prevProgressPct: number | null;
    currentProgressPct: number | null;
    prevBilled: number | null;
    amount: number;
    quantity: number | null;
    unit: string;
    rate: number | null;
    retentionApplies: boolean;
    retentionPct: number;
    retentionAmount: number;
    taxable: boolean;
    taxPct: number;
    taxAmount: number;
    reimbursableId: string;
    retentionReleaseId: string;
    creditsLineId: string;
}
export declare class FinanceSequenceEntity {
    id: string;
    next: number;
}
export declare class ProjectPaymentEntity extends FinanceStamped {
    id: string;
    invoiceId: string;
    projectId: number;
    date: string;
    amount: number;
    currency: string;
    fxRate: number;
    method: string;
    bankRef: string;
    txnRef: string;
    notes: string;
    attachments: TaskAttachment[];
    voidedAt: string;
    voidedByName: string;
    voidReason: string;
}
export declare class FinanceActivityEntity {
    id: string;
    projectId: number;
    entityType: string;
    entityId: string;
    action: string;
    changes: Record<string, {
        from: unknown;
        to: unknown;
    }> | null;
    reason: string;
    byName: string;
    byId: string;
    at: string;
}
export declare class ChangeOrderEntity extends FinanceStamped {
    id: string;
    projectId: number;
    number: string;
    title: string;
    description: string;
    reason: string;
    requestedBy: string;
    status: string;
    scheduleImpactDays: number;
    amount: number | null;
    dateRequested: string;
    notes: string;
    attachments: TaskAttachment[];
    submittedAt: string;
    submittedBy: string;
    internalApprovedAt: string;
    internalApprovedBy: string;
    clientSigner: string;
    clientApprovedDate: string;
    clientReference: string;
    approvedAt: string;
    approvedBy: string;
    rejectedAt: string;
    rejectedBy: string;
    cancelledAt: string;
    cancelledBy: string;
    closedReason: string;
}
export declare class ChangeOrderItemEntity {
    id: string;
    changeOrderId: string;
    projectId: number;
    lineOrder: number;
    description: string;
    targetType: string;
    phaseId: string;
    taskId: string;
    newName: string;
    amount: number;
    cost: number | null;
    quantity: number | null;
    unit: string;
    rate: number | null;
    csiCodeId: string;
    createdAt: string;
}
export declare class ReimbursableEntity extends FinanceStamped {
    id: string;
    projectId: number;
    number: string;
    date: string;
    description: string;
    category: string;
    vendor: string;
    cost: number;
    markupPct: number;
    billable: boolean;
    taxable: boolean;
    phaseId: string;
    csiCodeId: string;
    status: string;
    submittedBy: string;
    approvedAt: string;
    approvedBy: string;
    rejectedAt: string;
    rejectedBy: string;
    rejectedReason: string;
    invoiceId: string;
    notes: string;
    attachments: TaskAttachment[];
}
export declare class RetentionReleaseEntity extends FinanceStamped {
    id: string;
    projectId: number;
    number: string;
    scope: string;
    targetId: string;
    amount: number;
    reason: string;
    notes: string;
    status: string;
    requestedBy: string;
    approvedAt: string;
    approvedBy: string;
    rejectedAt: string;
    rejectedBy: string;
    closedReason: string;
    invoiceId: string;
}
export declare class FinancialApprovalEntity {
    id: string;
    projectId: number;
    entityType: string;
    entityId: string;
    decision: string;
    comment: string;
    signer: string;
    amount: number | null;
    byName: string;
    byId: string;
    at: string;
}
export declare class CostBudgetLineEntity extends FinanceStamped {
    id: string;
    projectId: number;
    csiCodeId: string;
    phaseId: string;
    taskId: string;
    description: string;
    amount: number;
    notes: string;
}
export declare class CommitmentEntity extends FinanceStamped {
    id: string;
    projectId: number;
    number: string;
    type: string;
    contractorId: string;
    vendorName: string;
    title: string;
    scope: string;
    status: string;
    dateIssued: string;
    approvedAt: string;
    approvedBy: string;
    closedAt: string;
    closedBy: string;
    closedReason: string;
    notes: string;
    attachments: TaskAttachment[];
    sharedAttachments: TaskAttachment[];
}
export declare class CommitmentLineEntity {
    id: string;
    commitmentId: string;
    projectId: number;
    lineOrder: number;
    description: string;
    csiCodeId: string;
    phaseId: string;
    taskId: string;
    amount: number;
}
export declare class CostEntryEntity extends FinanceStamped {
    id: string;
    projectId: number;
    date: string;
    dueDate: string;
    type: string;
    contractorId: string;
    vendorName: string;
    reference: string;
    commitmentId: string;
    csiCodeId: string;
    phaseId: string;
    taskId: string;
    description: string;
    amount: number;
    status: string;
    approvedBy: string;
    approvedAt: string;
    paidDate: string;
    paymentRef: string;
    voidReason: string;
    notes: string;
    attachments: TaskAttachment[];
    source: string;
    batchId: string;
    submittedByUserId: string;
}
export declare class CostForecastEntity extends FinanceStamped {
    id: string;
    projectId: number;
    csiCodeId: string;
    eac: number;
    note: string;
}
export interface RfiDrawingRef {
    fileId: string;
    name: string;
}
export interface RfiContact {
    name: string;
    email?: string;
    company?: string;
    personId?: number;
}
export interface RfiEvent {
    at: string;
    by: string;
    action: string;
    note?: string;
}
export declare class RfiEntity {
    id: string;
    projectId: number;
    number: string;
    subject: string;
    status: string;
    priority: string;
    question: string;
    suggestion: string;
    discipline: string;
    specSection: string;
    drawingRef: string;
    drawings: RfiDrawingRef[] | null;
    to: RfiContact | null;
    cc: RfiContact[] | null;
    ownerId: string;
    ownerName: string;
    dateSent: string;
    dateDue: string;
    dateAnswered: string;
    dateClosed: string;
    answer: string;
    answeredBy: string;
    costImpact: string;
    costAmount: number | null;
    scheduleImpact: string;
    scheduleDays: number | null;
    changeOrderId: string;
    changeOrderNumber: string;
    sourceTaskId: string;
    sourceTaskType: string;
    attachments: TaskAttachment[] | null;
    history: RfiEvent[] | null;
    voidReason: string;
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
}
export {};
