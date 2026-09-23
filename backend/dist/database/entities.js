"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccommodationUnitEntity = exports.AssetIssueEntity = exports.AssetEntity = exports.ShiftAssignmentEntity = exports.ShiftTemplateEntity = exports.PublicHolidayEntity = exports.LeaveAdjustmentEntity = exports.LeaveTypeEntity = exports.LeaveRequestEntity = exports.LaborLogEntryEntity = exports.DailyLogEntity = exports.CsiCodeEntity = exports.EmployeeRecordEntity = exports.TradeEntity = exports.ContractorEntity = exports.WorkforceRequestEntity = exports.EmployeeAssignmentEntity = exports.EmployeeAdvanceEntity = exports.OvertimeRequestEntity = exports.PayslipEntity = exports.PayrollRunEntity = exports.PayComponentEntity = exports.EmployeeEntity = exports.FileRoomFolderEntity = exports.FileRoomFileEntity = exports.AppSettingEntity = exports.UserEntity = exports.ProjectProgramVersionEntity = exports.GuestAccessEntity = exports.LeadProgramEntity = exports.ProjectProgramEntity = exports.ProjectPhaseEntity = exports.ProjectTaskEntity = exports.ProjectSectionEntity = exports.WorkflowItemEntity = exports.WorkflowEntity = exports.EmailTemplateEntity = exports.ConsultantEntity = exports.FaqEntity = exports.TicketEntity = exports.RoleEntity = exports.ScoringCriterionEntity = exports.LeadEntity = exports.FinanceEntity = exports.InvoiceEntity = exports.ProposalEntity = exports.DealEntity = exports.TaskEntity = exports.PersonEntity = exports.ProjectEntity = void 0;
exports.TransportAssignmentEntity = exports.TransportRouteEntity = exports.AccommodationIssueEntity = exports.BedAllocationEntity = void 0;
const typeorm_1 = require("typeorm");
const TEXT = { type: 'nvarchar', length: 'MAX' };
let ProjectEntity = class ProjectEntity {
};
exports.ProjectEntity = ProjectEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('int'),
    __metadata("design:type", Number)
], ProjectEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "typeOfWork", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "contractType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "contractAmt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "estStart", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.Column)(TEXT),
    __metadata("design:type", String)
], ProjectEntity.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "stage", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], ProjectEntity.prototype, "progress", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "referral", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "contactedBy", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectEntity.prototype, "imgColor", void 0);
__decorate([
    (0, typeorm_1.Column)(TEXT),
    __metadata("design:type", String)
], ProjectEntity.prototype, "img", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "designPhase", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "leadId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "introLetterSentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "introLetterSubject", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'nvarchar', length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "introLetterHtml", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], ProjectEntity.prototype, "contractApproved", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "templateKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectEntity.prototype, "website", void 0);
exports.ProjectEntity = ProjectEntity = __decorate([
    (0, typeorm_1.Entity)('projects')
], ProjectEntity);
let PersonEntity = class PersonEntity {
};
exports.PersonEntity = PersonEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('int'),
    __metadata("design:type", Number)
], PersonEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PersonEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PersonEntity.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PersonEntity.prototype, "company", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'nvarchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], PersonEntity.prototype, "contact", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PersonEntity.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PersonEntity.prototype, "tier", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PersonEntity.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PersonEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], PersonEntity.prototype, "projects", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], PersonEntity.prototype, "openTasks", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PersonEntity.prototype, "since", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PersonEntity.prototype, "comply", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PersonEntity.prototype, "last", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PersonEntity.prototype, "firstName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PersonEntity.prototype, "lastName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PersonEntity.prototype, "goByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PersonEntity.prototype, "pronouns", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PersonEntity.prototype, "gender", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], PersonEntity.prototype, "categories", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PersonEntity.prototype, "addresses", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PersonEntity.prototype, "contactInfo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], PersonEntity.prototype, "licenses", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PersonEntity.prototype, "insurance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], PersonEntity.prototype, "notLicensedDesigner", void 0);
exports.PersonEntity = PersonEntity = __decorate([
    (0, typeorm_1.Entity)('people')
], PersonEntity);
let TaskEntity = class TaskEntity {
};
exports.TaskEntity = TaskEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], TaskEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TaskEntity.prototype, "tab", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TaskEntity.prototype, "meetingType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TaskEntity.prototype, "meetingDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TaskEntity.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TaskEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TaskEntity.prototype, "originator", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TaskEntity.prototype, "topicType", void 0);
__decorate([
    (0, typeorm_1.Column)(TEXT),
    __metadata("design:type", String)
], TaskEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TaskEntity.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TaskEntity.prototype, "dueTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TaskEntity.prototype, "dateClosed", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], TaskEntity.prototype, "daysOpen", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'nvarchar', length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], TaskEntity.prototype, "resolution", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TaskEntity.prototype, "linkedFile", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TaskEntity.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TaskEntity.prototype, "assignedToId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], TaskEntity.prototype, "attachments", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], TaskEntity.prototype, "comments", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], TaskEntity.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], TaskEntity.prototype, "checklist", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], TaskEntity.prototype, "labels", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TaskEntity.prototype, "updatedAt", void 0);
exports.TaskEntity = TaskEntity = __decorate([
    (0, typeorm_1.Entity)('tasks')
], TaskEntity);
let DealEntity = class DealEntity {
};
exports.DealEntity = DealEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], DealEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "value", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "stage", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], DealEntity.prototype, "stageIdx", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "assignedRole", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "assignee", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "assigneeInit", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], DealEntity.prototype, "daysInStage", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "nextAction", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "nextDue", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], DealEntity.prototype, "timeline", void 0);
__decorate([
    (0, typeorm_1.Column)(TEXT),
    __metadata("design:type", String)
], DealEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DealEntity.prototype, "stageEnteredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DealEntity.prototype, "holdUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], DealEntity.prototype, "archived", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DealEntity.prototype, "archivedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], DealEntity.prototype, "convertedProjectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], DealEntity.prototype, "roles", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], DealEntity.prototype, "followUps", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], DealEntity.prototype, "stageNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DealEntity.prototype, "rejectionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DealEntity.prototype, "rejectionReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DealEntity.prototype, "referredToName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DealEntity.prototype, "referredToCompany", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DealEntity.prototype, "referredToContact", void 0);
exports.DealEntity = DealEntity = __decorate([
    (0, typeorm_1.Entity)('deals')
], DealEntity);
let ProposalEntity = class ProposalEntity {
};
exports.ProposalEntity = ProposalEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ProposalEntity.prototype, "dealId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)('nvarchar', { length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "html", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "sentTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signedByEmail", void 0);
__decorate([
    (0, typeorm_1.Column)('nvarchar', { length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signatureImage", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signerIp", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signerUserAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], ProposalEntity.prototype, "reviewedAllPages", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], ProposalEntity.prototype, "requiresSecondSignatory", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signedAt2", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signedByName2", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signedByEmail2", void 0);
__decorate([
    (0, typeorm_1.Column)('nvarchar', { length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signatureImage2", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signerIp2", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProposalEntity.prototype, "signerUserAgent2", void 0);
exports.ProposalEntity = ProposalEntity = __decorate([
    (0, typeorm_1.Entity)('proposals')
], ProposalEntity);
let InvoiceEntity = class InvoiceEntity {
};
exports.InvoiceEntity = InvoiceEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], InvoiceEntity.prototype, "pk", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InvoiceEntity.prototype, "invId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InvoiceEntity.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InvoiceEntity.prototype, "project", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InvoiceEntity.prototype, "month", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], InvoiceEntity.prototype, "issued", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], InvoiceEntity.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], InvoiceEntity.prototype, "paid", void 0);
exports.InvoiceEntity = InvoiceEntity = __decorate([
    (0, typeorm_1.Entity)('invoices')
], InvoiceEntity);
let FinanceEntity = class FinanceEntity {
};
exports.FinanceEntity = FinanceEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], FinanceEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FinanceEntity.prototype, "exec", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FinanceEntity.prototype, "contract", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FinanceEntity.prototype, "labor", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FinanceEntity.prototype, "phase", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FinanceEntity.prototype, "base", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FinanceEntity.prototype, "co", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FinanceEntity.prototype, "reimb", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FinanceEntity.prototype, "baseUsed", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FinanceEntity.prototype, "coUsed", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FinanceEntity.prototype, "reimbUsed", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FinanceEntity.prototype, "timePct", void 0);
exports.FinanceEntity = FinanceEntity = __decorate([
    (0, typeorm_1.Entity)('finance')
], FinanceEntity);
let LeadEntity = class LeadEntity {
};
exports.LeadEntity = LeadEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], LeadEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeadEntity.prototype, "leadName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "businessName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "firstName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "lastName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "goByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "pronouns", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "namePronunciation", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeadEntity.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "primaryPointOfContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "secondPointOfContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "nameOfSecondContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "phoneOfSecondContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "emailOfSecondContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "relationshipOfSecondContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "preferredContactMethodOfSecondContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "pronounsOfSecondContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], LeadEntity.prototype, "additionalContacts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], LeadEntity.prototype, "primaryContactRoles", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], LeadEntity.prototype, "sectionNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], LeadEntity.prototype, "sectionCustomFields", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], LeadEntity.prototype, "contacts", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "decisionMakers", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "preferredContactMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], LeadEntity.prototype, "preferredContactMatrix", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "leadSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "leadSourceReferrerName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "leadSourceReferrerPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "leadSourceEventDetail", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "projectStreetAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "projectStreetName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "projectAddress2", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "occupancyStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "projectCity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "projectZipCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "countyLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "hasHOA", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], LeadEntity.prototype, "addresses", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "propertyType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "potentialProjectType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "contractType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], LeadEntity.prototype, "otherDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], LeadEntity.prototype, "homeworkCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "projectVision", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "reasonForProject", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "budgetPosition", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "fundingStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "desiredStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "expectedDuration", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "expectedLengthOfOwnership", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "clientPersonality", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "virtualMeetingAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "siteVisitAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "meetingType", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "meetingAgenda", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "meetingEventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], LeadEntity.prototype, "fitScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], LeadEntity.prototype, "fitSelections", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "zoningImages", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "zoningAnalysis", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "website", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeadEntity.prototype, "createdAt", void 0);
exports.LeadEntity = LeadEntity = __decorate([
    (0, typeorm_1.Entity)('leads')
], LeadEntity);
let ScoringCriterionEntity = class ScoringCriterionEntity {
};
exports.ScoringCriterionEntity = ScoringCriterionEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ScoringCriterionEntity.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], ScoringCriterionEntity.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScoringCriterionEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ScoringCriterionEntity.prototype, "subCriteria", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], ScoringCriterionEntity.prototype, "maxPoints", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], ScoringCriterionEntity.prototype, "options", void 0);
exports.ScoringCriterionEntity = ScoringCriterionEntity = __decorate([
    (0, typeorm_1.Entity)('scoring_criteria')
], ScoringCriterionEntity);
let RoleEntity = class RoleEntity {
};
exports.RoleEntity = RoleEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], RoleEntity.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RoleEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RoleEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RoleEntity.prototype, "tier", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], RoleEntity.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RoleEntity.prototype, "isSystem", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], RoleEntity.prototype, "permissions", void 0);
exports.RoleEntity = RoleEntity = __decorate([
    (0, typeorm_1.Entity)('roles')
], RoleEntity);
let TicketEntity = class TicketEntity {
};
exports.TicketEntity = TicketEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], TicketEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TicketEntity.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TicketEntity.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TicketEntity.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)(TEXT),
    __metadata("design:type", String)
], TicketEntity.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TicketEntity.prototype, "requesterName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TicketEntity.prototype, "requesterEmail", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TicketEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TicketEntity.prototype, "createdAt", void 0);
exports.TicketEntity = TicketEntity = __decorate([
    (0, typeorm_1.Entity)('tickets')
], TicketEntity);
let FaqEntity = class FaqEntity {
};
exports.FaqEntity = FaqEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], FaqEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FaqEntity.prototype, "question", void 0);
__decorate([
    (0, typeorm_1.Column)(TEXT),
    __metadata("design:type", String)
], FaqEntity.prototype, "answer", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FaqEntity.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FaqEntity.prototype, "order", void 0);
exports.FaqEntity = FaqEntity = __decorate([
    (0, typeorm_1.Entity)('faqs')
], FaqEntity);
let ConsultantEntity = class ConsultantEntity {
};
exports.ConsultantEntity = ConsultantEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ConsultantEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ConsultantEntity.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ConsultantEntity.prototype, "firm", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ConsultantEntity.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ConsultantEntity.prototype, "contact", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ConsultantEntity.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ConsultantEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ConsultantEntity.prototype, "rfpSent", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ConsultantEntity.prototype, "bidInterest", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ConsultantEntity.prototype, "proposalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ConsultantEntity.prototype, "signedContract", void 0);
exports.ConsultantEntity = ConsultantEntity = __decorate([
    (0, typeorm_1.Entity)('consultants')
], ConsultantEntity);
let EmailTemplateEntity = class EmailTemplateEntity {
};
exports.EmailTemplateEntity = EmailTemplateEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], EmailTemplateEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmailTemplateEntity.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmailTemplateEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], EmailTemplateEntity.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)(TEXT),
    __metadata("design:type", String)
], EmailTemplateEntity.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmailTemplateEntity.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmailTemplateEntity.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmailTemplateEntity.prototype, "updatedAt", void 0);
exports.EmailTemplateEntity = EmailTemplateEntity = __decorate([
    (0, typeorm_1.Entity)('email_templates')
], EmailTemplateEntity);
let WorkflowEntity = class WorkflowEntity {
};
exports.WorkflowEntity = WorkflowEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], WorkflowEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], WorkflowEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkflowEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], WorkflowEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkflowEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkflowEntity.prototype, "owner", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], WorkflowEntity.prototype, "estimatedDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkflowEntity.prototype, "plannedStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkflowEntity.prototype, "plannedEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkflowEntity.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkflowEntity.prototype, "createdAt", void 0);
exports.WorkflowEntity = WorkflowEntity = __decorate([
    (0, typeorm_1.Entity)('workflows')
], WorkflowEntity);
let WorkflowItemEntity = class WorkflowItemEntity {
};
exports.WorkflowItemEntity = WorkflowItemEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], WorkflowItemEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkflowItemEntity.prototype, "workflowId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkflowItemEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkflowItemEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], WorkflowItemEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], WorkflowItemEntity.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], WorkflowItemEntity.prototype, "estimatedDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkflowItemEntity.prototype, "plannedStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkflowItemEntity.prototype, "plannedEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkflowItemEntity.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkflowItemEntity.prototype, "createdAt", void 0);
exports.WorkflowItemEntity = WorkflowItemEntity = __decorate([
    (0, typeorm_1.Entity)('workflow_items')
], WorkflowItemEntity);
let ProjectSectionEntity = class ProjectSectionEntity {
};
exports.ProjectSectionEntity = ProjectSectionEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ProjectSectionEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ProjectSectionEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectSectionEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], ProjectSectionEntity.prototype, "order", void 0);
exports.ProjectSectionEntity = ProjectSectionEntity = __decorate([
    (0, typeorm_1.Entity)('project_sections')
], ProjectSectionEntity);
let ProjectTaskEntity = class ProjectTaskEntity {
};
exports.ProjectTaskEntity = ProjectTaskEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ProjectTaskEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "sectionId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "assignee", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], ProjectTaskEntity.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ProjectTaskEntity.prototype, "completed", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "parentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], ProjectTaskEntity.prototype, "attachments", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], ProjectTaskEntity.prototype, "comments", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "assigneeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], ProjectTaskEntity.prototype, "checklist", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], ProjectTaskEntity.prototype, "labels", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], ProjectTaskEntity.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "phaseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "team", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, default: false }),
    __metadata("design:type", Boolean)
], ProjectTaskEntity.prototype, "auto", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "autoLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectTaskEntity.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ProjectTaskEntity.prototype, "durationDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], ProjectTaskEntity.prototype, "dependsOn", void 0);
exports.ProjectTaskEntity = ProjectTaskEntity = __decorate([
    (0, typeorm_1.Entity)('project_tasks')
], ProjectTaskEntity);
let ProjectPhaseEntity = class ProjectPhaseEntity {
};
exports.ProjectPhaseEntity = ProjectPhaseEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], ProjectPhaseEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "color", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], ProjectPhaseEntity.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "seededAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "notified50", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "notified90", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectPhaseEntity.prototype, "notified100", void 0);
exports.ProjectPhaseEntity = ProjectPhaseEntity = __decorate([
    (0, typeorm_1.Entity)('project_phases')
], ProjectPhaseEntity);
let ProjectProgramEntity = class ProjectProgramEntity {
};
exports.ProjectProgramEntity = ProjectProgramEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('int'),
    __metadata("design:type", Number)
], ProjectProgramEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)('nvarchar', { length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "data", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "sentTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "signedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "signedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "signedByEmail", void 0);
__decorate([
    (0, typeorm_1.Column)('nvarchar', { length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "signatureImage", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "signerIp", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramEntity.prototype, "signerUserAgent", void 0);
exports.ProjectProgramEntity = ProjectProgramEntity = __decorate([
    (0, typeorm_1.Entity)('project_programs')
], ProjectProgramEntity);
let LeadProgramEntity = class LeadProgramEntity {
};
exports.LeadProgramEntity = LeadProgramEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], LeadProgramEntity.prototype, "leadId", void 0);
__decorate([
    (0, typeorm_1.Column)('nvarchar', { length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], LeadProgramEntity.prototype, "data", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadProgramEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadProgramEntity.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadProgramEntity.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadProgramEntity.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadProgramEntity.prototype, "sentTo", void 0);
exports.LeadProgramEntity = LeadProgramEntity = __decorate([
    (0, typeorm_1.Entity)('lead_programs')
], LeadProgramEntity);
let GuestAccessEntity = class GuestAccessEntity {
};
exports.GuestAccessEntity = GuestAccessEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GuestAccessEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GuestAccessEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], GuestAccessEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GuestAccessEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], GuestAccessEntity.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], GuestAccessEntity.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], GuestAccessEntity.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], GuestAccessEntity.prototype, "lastUsedAt", void 0);
exports.GuestAccessEntity = GuestAccessEntity = __decorate([
    (0, typeorm_1.Entity)('guest_access')
], GuestAccessEntity);
let ProjectProgramVersionEntity = class ProjectProgramVersionEntity {
};
exports.ProjectProgramVersionEntity = ProjectProgramVersionEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ProjectProgramVersionEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectProgramVersionEntity.prototype, "ownerKey", void 0);
__decorate([
    (0, typeorm_1.Column)('nvarchar', { length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], ProjectProgramVersionEntity.prototype, "data", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ProjectProgramVersionEntity.prototype, "savedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ProjectProgramVersionEntity.prototype, "savedBy", void 0);
exports.ProjectProgramVersionEntity = ProjectProgramVersionEntity = __decorate([
    (0, typeorm_1.Entity)('project_program_versions')
], ProjectProgramVersionEntity);
let UserEntity = class UserEntity {
};
exports.UserEntity = UserEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], UserEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserEntity.prototype, "tier", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserEntity.prototype, "roleKey", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "lastLogin", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "passwordSetAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "googleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'nvarchar', length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "avatarUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "inviteToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "inviteSentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "inviteExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], UserEntity.prototype, "notifyOnAssignment", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], UserEntity.prototype, "notifyByEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], UserEntity.prototype, "notifyBySms", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "digestFrequency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], UserEntity.prototype, "notifyOnOverdue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bit', nullable: true }),
    __metadata("design:type", Object)
], UserEntity.prototype, "notifyOnMilestone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "calendarRefreshToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "calendarEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserEntity.prototype, "calendarConnectedAt", void 0);
exports.UserEntity = UserEntity = __decorate([
    (0, typeorm_1.Entity)('users')
], UserEntity);
let AppSettingEntity = class AppSettingEntity {
};
exports.AppSettingEntity = AppSettingEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], AppSettingEntity.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'nvarchar', length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], AppSettingEntity.prototype, "value", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AppSettingEntity.prototype, "updatedAt", void 0);
exports.AppSettingEntity = AppSettingEntity = __decorate([
    (0, typeorm_1.Entity)('app_settings')
], AppSettingEntity);
let FileRoomFileEntity = class FileRoomFileEntity {
};
exports.FileRoomFileEntity = FileRoomFileEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FileRoomFileEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], FileRoomFileEntity.prototype, "folderPath", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "ext", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', nullable: true }),
    __metadata("design:type", Number)
], FileRoomFileEntity.prototype, "size", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "driveId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "uploadedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "uploadedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "groupId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, default: true }),
    __metadata("design:type", Boolean)
], FileRoomFileEntity.prototype, "isLatest", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'nvarchar', length: 'MAX', nullable: true }),
    __metadata("design:type", String)
], FileRoomFileEntity.prototype, "notes", void 0);
exports.FileRoomFileEntity = FileRoomFileEntity = __decorate([
    (0, typeorm_1.Entity)('file_room_files')
], FileRoomFileEntity);
let FileRoomFolderEntity = class FileRoomFolderEntity {
};
exports.FileRoomFolderEntity = FileRoomFolderEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], FileRoomFolderEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FileRoomFolderEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], FileRoomFolderEntity.prototype, "path", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FileRoomFolderEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FileRoomFolderEntity.prototype, "createdAt", void 0);
exports.FileRoomFolderEntity = FileRoomFolderEntity = __decorate([
    (0, typeorm_1.Entity)('file_room_folders')
], FileRoomFolderEntity);
let EmployeeEntity = class EmployeeEntity {
};
exports.EmployeeEntity = EmployeeEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "jobTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "trade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], EmployeeEntity.prototype, "expertise", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "payType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], EmployeeEntity.prototype, "payRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "hireDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'active' }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "supervisorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "workerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "fatherOrSpouseName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "nationalId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "dob", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "gender", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "emergencyContactName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "emergencyContactPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "emergencyContactRelation", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "permanentAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "currentAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], EmployeeEntity.prototype, "photo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "employmentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "department", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "designation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "grade", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "employmentStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "hrOfficerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "bankName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "bankAccount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "taxNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "tradeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "skillLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], EmployeeEntity.prototype, "yearsExperience", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], EmployeeEntity.prototype, "equipmentCapabilities", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "contractorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeEntity.prototype, "siteAccessStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], EmployeeEntity.prototype, "payComponents", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], EmployeeEntity.prototype, "overtimeRate", void 0);
exports.EmployeeEntity = EmployeeEntity = __decorate([
    (0, typeorm_1.Entity)('employees')
], EmployeeEntity);
let PayComponentEntity = class PayComponentEntity {
};
exports.PayComponentEntity = PayComponentEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], PayComponentEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayComponentEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayComponentEntity.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayComponentEntity.prototype, "calcType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], PayComponentEntity.prototype, "defaultValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'all' }),
    __metadata("design:type", String)
], PayComponentEntity.prototype, "appliesTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayComponentEntity.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], PayComponentEntity.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], PayComponentEntity.prototype, "order", void 0);
exports.PayComponentEntity = PayComponentEntity = __decorate([
    (0, typeorm_1.Entity)('pay_components')
], PayComponentEntity);
let PayrollRunEntity = class PayrollRunEntity {
};
exports.PayrollRunEntity = PayrollRunEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "label", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "periodStart", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "periodEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'all' }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "payGroup", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'draft' }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PayrollRunEntity.prototype, "totals", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PayrollRunEntity.prototype, "settingsSnapshot", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "finalizedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "finalizedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "voidedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "voidedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "voidReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayrollRunEntity.prototype, "updatedAt", void 0);
exports.PayrollRunEntity = PayrollRunEntity = __decorate([
    (0, typeorm_1.Entity)('payroll_runs')
], PayrollRunEntity);
let PayslipEntity = class PayslipEntity {
};
exports.PayslipEntity = PayslipEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], PayslipEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayslipEntity.prototype, "runId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayslipEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Object)
], PayslipEntity.prototype, "employee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Object)
], PayslipEntity.prototype, "basis", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Array)
], PayslipEntity.prototype, "lines", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], PayslipEntity.prototype, "gross", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], PayslipEntity.prototype, "deductions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], PayslipEntity.prototype, "net", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'unpaid' }),
    __metadata("design:type", String)
], PayslipEntity.prototype, "paymentStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayslipEntity.prototype, "paidAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayslipEntity.prototype, "paymentMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayslipEntity.prototype, "paymentRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayslipEntity.prototype, "paidByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], PayslipEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayslipEntity.prototype, "updatedAt", void 0);
exports.PayslipEntity = PayslipEntity = __decorate([
    (0, typeorm_1.Entity)('payslips')
], PayslipEntity);
let OvertimeRequestEntity = class OvertimeRequestEntity {
};
exports.OvertimeRequestEntity = OvertimeRequestEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], OvertimeRequestEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], OvertimeRequestEntity.prototype, "hours", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'normal' }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "otType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], OvertimeRequestEntity.prototype, "rate", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'manual' }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "requestedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "requestedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "decidedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "decidedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "decisionNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], OvertimeRequestEntity.prototype, "baseRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], OvertimeRequestEntity.prototype, "multiplier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], OvertimeRequestEntity.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "payrollRunId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OvertimeRequestEntity.prototype, "updatedAt", void 0);
exports.OvertimeRequestEntity = OvertimeRequestEntity = __decorate([
    (0, typeorm_1.Entity)('overtime_requests')
], OvertimeRequestEntity);
let EmployeeAdvanceEntity = class EmployeeAdvanceEntity {
};
exports.EmployeeAdvanceEntity = EmployeeAdvanceEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], EmployeeAdvanceEntity.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "requestDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], EmployeeAdvanceEntity.prototype, "installments", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], EmployeeAdvanceEntity.prototype, "installmentAmount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "deductionStart", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Array)
], EmployeeAdvanceEntity.prototype, "approvals", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "disbursedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "disbursedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "paymentMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "paymentRef", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Array)
], EmployeeAdvanceEntity.prototype, "repayments", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], EmployeeAdvanceEntity.prototype, "recovered", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAdvanceEntity.prototype, "updatedAt", void 0);
exports.EmployeeAdvanceEntity = EmployeeAdvanceEntity = __decorate([
    (0, typeorm_1.Entity)('employee_advances')
], EmployeeAdvanceEntity);
let EmployeeAssignmentEntity = class EmployeeAssignmentEntity {
};
exports.EmployeeAssignmentEntity = EmployeeAssignmentEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], EmployeeAssignmentEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "workArea", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "tradeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "designation", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'regular' }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "assignmentType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'active' }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "endReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "transferredFromId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "workforceRequestId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "requestLineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "endedByName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeAssignmentEntity.prototype, "updatedAt", void 0);
exports.EmployeeAssignmentEntity = EmployeeAssignmentEntity = __decorate([
    (0, typeorm_1.Entity)('employee_assignments')
], EmployeeAssignmentEntity);
let WorkforceRequestEntity = class WorkforceRequestEntity {
};
exports.WorkforceRequestEntity = WorkforceRequestEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], WorkforceRequestEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "workArea", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "requiredDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], WorkforceRequestEntity.prototype, "durationDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Array)
], WorkforceRequestEntity.prototype, "lines", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'draft' }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "requestedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "requestedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "submittedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "decidedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "decidedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "decisionNote", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], WorkforceRequestEntity.prototype, "updatedAt", void 0);
exports.WorkforceRequestEntity = WorkforceRequestEntity = __decorate([
    (0, typeorm_1.Entity)('workforce_requests')
], WorkforceRequestEntity);
let ContractorEntity = class ContractorEntity {
};
exports.ContractorEntity = ContractorEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ContractorEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ContractorEntity.prototype, "companyName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ContractorEntity.prototype, "personId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "contactPerson", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "contractNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "contractStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "contractEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "scopeOfWork", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "agreedRates", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "insuranceProvider", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "insurancePolicyNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "insuranceExpiry", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'active' }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], ContractorEntity.prototype, "attachments", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ContractorEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ContractorEntity.prototype, "updatedAt", void 0);
exports.ContractorEntity = ContractorEntity = __decorate([
    (0, typeorm_1.Entity)('contractors')
], ContractorEntity);
let TradeEntity = class TradeEntity {
};
exports.TradeEntity = TradeEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], TradeEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TradeEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], TradeEntity.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], TradeEntity.prototype, "order", void 0);
exports.TradeEntity = TradeEntity = __decorate([
    (0, typeorm_1.Entity)('trades')
], TradeEntity);
let EmployeeRecordEntity = class EmployeeRecordEntity {
};
exports.EmployeeRecordEntity = EmployeeRecordEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "number", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "issuer", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "issueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "expiryDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], EmployeeRecordEntity.prototype, "rate", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "terms", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "verification", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], EmployeeRecordEntity.prototype, "attachments", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], EmployeeRecordEntity.prototype, "updatedAt", void 0);
exports.EmployeeRecordEntity = EmployeeRecordEntity = __decorate([
    (0, typeorm_1.Entity)('employee_records')
], EmployeeRecordEntity);
let CsiCodeEntity = class CsiCodeEntity {
};
exports.CsiCodeEntity = CsiCodeEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], CsiCodeEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CsiCodeEntity.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CsiCodeEntity.prototype, "division", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], CsiCodeEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], CsiCodeEntity.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], CsiCodeEntity.prototype, "order", void 0);
exports.CsiCodeEntity = CsiCodeEntity = __decorate([
    (0, typeorm_1.Entity)('csi_codes')
], CsiCodeEntity);
let DailyLogEntity = class DailyLogEntity {
};
exports.DailyLogEntity = DailyLogEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], DailyLogEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "supervisorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "supervisorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'draft' }),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "submittedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "approvedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "approvedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "rejectionNote", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DailyLogEntity.prototype, "createdAt", void 0);
exports.DailyLogEntity = DailyLogEntity = __decorate([
    (0, typeorm_1.Entity)('daily_logs')
], DailyLogEntity);
let LaborLogEntryEntity = class LaborLogEntryEntity {
};
exports.LaborLogEntryEntity = LaborLogEntryEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], LaborLogEntryEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LaborLogEntryEntity.prototype, "dailyLogId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LaborLogEntryEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LaborLogEntryEntity.prototype, "csiCodeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], LaborLogEntryEntity.prototype, "hours", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], LaborLogEntryEntity.prototype, "taskDetail", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LaborLogEntryEntity.prototype, "taskStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LaborLogEntryEntity.prototype, "team", void 0);
exports.LaborLogEntryEntity = LaborLogEntryEntity = __decorate([
    (0, typeorm_1.Entity)('labor_log_entries')
], LaborLogEntryEntity);
let LeaveRequestEntity = class LeaveRequestEntity {
};
exports.LeaveRequestEntity = LeaveRequestEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], LeaveRequestEntity.prototype, "hours", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "requestedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "decidedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "decidedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "leaveTypeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, default: false }),
    __metadata("design:type", Boolean)
], LeaveRequestEntity.prototype, "halfDay", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], LeaveRequestEntity.prototype, "days", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "requestedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeaveRequestEntity.prototype, "decidedById", void 0);
exports.LeaveRequestEntity = LeaveRequestEntity = __decorate([
    (0, typeorm_1.Entity)('leave_requests')
], LeaveRequestEntity);
let LeaveTypeEntity = class LeaveTypeEntity {
};
exports.LeaveTypeEntity = LeaveTypeEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], LeaveTypeEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveTypeEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], LeaveTypeEntity.prototype, "paid", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], LeaveTypeEntity.prototype, "trackBalance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], LeaveTypeEntity.prototype, "annualDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], LeaveTypeEntity.prototype, "carryForwardMax", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], LeaveTypeEntity.prototype, "encashable", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeaveTypeEntity.prototype, "color", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], LeaveTypeEntity.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], LeaveTypeEntity.prototype, "order", void 0);
exports.LeaveTypeEntity = LeaveTypeEntity = __decorate([
    (0, typeorm_1.Entity)('leave_types')
], LeaveTypeEntity);
let LeaveAdjustmentEntity = class LeaveAdjustmentEntity {
};
exports.LeaveAdjustmentEntity = LeaveAdjustmentEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], LeaveAdjustmentEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveAdjustmentEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveAdjustmentEntity.prototype, "leaveTypeId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], LeaveAdjustmentEntity.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveAdjustmentEntity.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float' }),
    __metadata("design:type", Number)
], LeaveAdjustmentEntity.prototype, "days", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], LeaveAdjustmentEntity.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeaveAdjustmentEntity.prototype, "payrollRunId", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], LeaveAdjustmentEntity.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeaveAdjustmentEntity.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LeaveAdjustmentEntity.prototype, "createdAt", void 0);
exports.LeaveAdjustmentEntity = LeaveAdjustmentEntity = __decorate([
    (0, typeorm_1.Entity)('leave_adjustments')
], LeaveAdjustmentEntity);
let PublicHolidayEntity = class PublicHolidayEntity {
};
exports.PublicHolidayEntity = PublicHolidayEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], PublicHolidayEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PublicHolidayEntity.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PublicHolidayEntity.prototype, "name", void 0);
exports.PublicHolidayEntity = PublicHolidayEntity = __decorate([
    (0, typeorm_1.Entity)('public_holidays')
], PublicHolidayEntity);
let ShiftTemplateEntity = class ShiftTemplateEntity {
};
exports.ShiftTemplateEntity = ShiftTemplateEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ShiftTemplateEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShiftTemplateEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShiftTemplateEntity.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShiftTemplateEntity.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShiftTemplateEntity.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShiftTemplateEntity.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', default: 0 }),
    __metadata("design:type", Number)
], ShiftTemplateEntity.prototype, "allowancePerDay", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShiftTemplateEntity.prototype, "color", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ShiftTemplateEntity.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], ShiftTemplateEntity.prototype, "order", void 0);
exports.ShiftTemplateEntity = ShiftTemplateEntity = __decorate([
    (0, typeorm_1.Entity)('shift_templates')
], ShiftTemplateEntity);
let ShiftAssignmentEntity = class ShiftAssignmentEntity {
};
exports.ShiftAssignmentEntity = ShiftAssignmentEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], ShiftAssignmentEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShiftAssignmentEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json' }),
    __metadata("design:type", Array)
], ShiftAssignmentEntity.prototype, "templateIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ShiftAssignmentEntity.prototype, "rotateEveryDays", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShiftAssignmentEntity.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShiftAssignmentEntity.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], ShiftAssignmentEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShiftAssignmentEntity.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShiftAssignmentEntity.prototype, "endedByName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShiftAssignmentEntity.prototype, "createdAt", void 0);
exports.ShiftAssignmentEntity = ShiftAssignmentEntity = __decorate([
    (0, typeorm_1.Entity)('shift_assignments')
], ShiftAssignmentEntity);
let AssetEntity = class AssetEntity {
};
exports.AssetEntity = AssetEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], AssetEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AssetEntity.prototype, "assetTag", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AssetEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AssetEntity.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AssetEntity.prototype, "serialNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'available' }),
    __metadata("design:type", String)
], AssetEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'good' }),
    __metadata("design:type", String)
], AssetEntity.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AssetEntity.prototype, "purchaseDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], AssetEntity.prototype, "cost", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], AssetEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AssetEntity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AssetEntity.prototype, "updatedAt", void 0);
exports.AssetEntity = AssetEntity = __decorate([
    (0, typeorm_1.Entity)('assets')
], AssetEntity);
let AssetIssueEntity = class AssetIssueEntity {
};
exports.AssetIssueEntity = AssetIssueEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "assetId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "issuedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "expectedReturn", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'open' }),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "returnedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "returnCondition", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], AssetIssueEntity.prototype, "chargeAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "replacesIssueId", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "issuedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AssetIssueEntity.prototype, "closedByName", void 0);
exports.AssetIssueEntity = AssetIssueEntity = __decorate([
    (0, typeorm_1.Entity)('asset_issues')
], AssetIssueEntity);
let AccommodationUnitEntity = class AccommodationUnitEntity {
};
exports.AccommodationUnitEntity = AccommodationUnitEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], AccommodationUnitEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AccommodationUnitEntity.prototype, "parentId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AccommodationUnitEntity.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AccommodationUnitEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], AccommodationUnitEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], AccommodationUnitEntity.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AccommodationUnitEntity.prototype, "createdAt", void 0);
exports.AccommodationUnitEntity = AccommodationUnitEntity = __decorate([
    (0, typeorm_1.Entity)('accommodation_units')
], AccommodationUnitEntity);
let BedAllocationEntity = class BedAllocationEntity {
};
exports.BedAllocationEntity = BedAllocationEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], BedAllocationEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BedAllocationEntity.prototype, "bedId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BedAllocationEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], BedAllocationEntity.prototype, "checkIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], BedAllocationEntity.prototype, "checkOut", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], BedAllocationEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], BedAllocationEntity.prototype, "byName", void 0);
exports.BedAllocationEntity = BedAllocationEntity = __decorate([
    (0, typeorm_1.Entity)('bed_allocations')
], BedAllocationEntity);
let AccommodationIssueEntity = class AccommodationIssueEntity {
};
exports.AccommodationIssueEntity = AccommodationIssueEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "unitId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'open' }),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "resolution", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "reportedByName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "reportedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AccommodationIssueEntity.prototype, "resolvedAt", void 0);
exports.AccommodationIssueEntity = AccommodationIssueEntity = __decorate([
    (0, typeorm_1.Entity)('accommodation_issues')
], AccommodationIssueEntity);
let TransportRouteEntity = class TransportRouteEntity {
};
exports.TransportRouteEntity = TransportRouteEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], TransportRouteEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TransportRouteEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TransportRouteEntity.prototype, "vehicle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], TransportRouteEntity.prototype, "capacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TransportRouteEntity.prototype, "driverEmployeeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], TransportRouteEntity.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TransportRouteEntity.prototype, "departureTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TransportRouteEntity.prototype, "returnTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Array)
], TransportRouteEntity.prototype, "pickupPoints", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'active' }),
    __metadata("design:type", String)
], TransportRouteEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ ...TEXT, nullable: true }),
    __metadata("design:type", String)
], TransportRouteEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TransportRouteEntity.prototype, "createdAt", void 0);
exports.TransportRouteEntity = TransportRouteEntity = __decorate([
    (0, typeorm_1.Entity)('transport_routes')
], TransportRouteEntity);
let TransportAssignmentEntity = class TransportAssignmentEntity {
};
exports.TransportAssignmentEntity = TransportAssignmentEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], TransportAssignmentEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TransportAssignmentEntity.prototype, "routeId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TransportAssignmentEntity.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TransportAssignmentEntity.prototype, "pickupPoint", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TransportAssignmentEntity.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TransportAssignmentEntity.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TransportAssignmentEntity.prototype, "byName", void 0);
exports.TransportAssignmentEntity = TransportAssignmentEntity = __decorate([
    (0, typeorm_1.Entity)('transport_assignments')
], TransportAssignmentEntity);
//# sourceMappingURL=entities.js.map