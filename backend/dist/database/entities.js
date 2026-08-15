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
exports.UserEntity = exports.RoleEntity = exports.ScoringCriterionEntity = exports.LeadEntity = exports.FinanceEntity = exports.InvoiceEntity = exports.DealEntity = exports.TaskEntity = exports.PersonEntity = exports.ProjectEntity = void 0;
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
], DealEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "client", void 0);
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
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DealEntity.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], DealEntity.prototype, "timeline", void 0);
__decorate([
    (0, typeorm_1.Column)(TEXT),
    __metadata("design:type", String)
], DealEntity.prototype, "notes", void 0);
exports.DealEntity = DealEntity = __decorate([
    (0, typeorm_1.Entity)('deals')
], DealEntity);
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
], LeadEntity.prototype, "decisionMakers", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "preferredContactMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "leadSource", void 0);
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
], LeadEntity.prototype, "propertyType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LeadEntity.prototype, "potentialProjectType", void 0);
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
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], LeadEntity.prototype, "fitScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], LeadEntity.prototype, "fitSelections", void 0);
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
    (0, typeorm_1.Column)({ type: 'bit', default: false }),
    __metadata("design:type", Boolean)
], RoleEntity.prototype, "isSystem", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], RoleEntity.prototype, "permissions", void 0);
exports.RoleEntity = RoleEntity = __decorate([
    (0, typeorm_1.Entity)('roles')
], RoleEntity);
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
exports.UserEntity = UserEntity = __decorate([
    (0, typeorm_1.Entity)('users')
], UserEntity);
//# sourceMappingURL=entities.js.map