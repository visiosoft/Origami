import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import type { TaskAttachment, TaskComment, ChecklistItem, ActivityEvent } from './task.types';

const TEXT = { type: 'nvarchar', length: 'MAX' } as const;

@Entity('projects')
export class ProjectEntity {
  @PrimaryColumn('int') id!: number;
  @Column() priority!: string;
  @Column() name!: string;
  @Column() location!: string;
  @Column() typeOfWork!: string;
  @Column() contractType!: string;
  @Column() contractAmt!: string;
  @Column() estStart!: string;
  @Column() duration!: string;
  @Column(TEXT) scope!: string;
  @Column() stage!: string;
  @Column('int') progress!: number;
  @Column({ nullable: true }) referral!: string;
  @Column() contactedBy!: string;
  @Column() imgColor!: string;
  @Column(TEXT) img!: string;
  // Set by dragging on the Design board. Overrides the phase derived from
  // task progress, so a team can park a project where they say it is.
  @Column({ nullable: true }) designPhase!: string;
  @Column({ nullable: true }) leadId!: string; // links to the originating LeadEntity (intake questionnaire)
  @Column({ nullable: true }) introLetterSentAt!: string; // ISO timestamp when the Introduction Letter was sent
}

@Entity('people')
export class PersonEntity {
  @PrimaryColumn('int') id!: number;
  @Column() name!: string;
  @Column() role!: string;
  @Column() company!: string;
  @Column({ type: 'nvarchar', length: 255, nullable: true }) contact!: string | null;
  @Column() kind!: string;
  @Column() tier!: string;
  @Column() phone!: string;
  @Column() email!: string;
  @Column('simple-json') projects!: string[];
  @Column('int') openTasks!: number;
  @Column() since!: string;
  @Column({ type: 'simple-json', nullable: true }) comply!: unknown;
  @Column() last!: string;
}

@Entity('tasks')
export class TaskEntity {
  @PrimaryColumn() id!: string;
  @Column() tab!: string; // internal | owner | subcontractor
  @Column() meetingType!: string;
  @Column() meetingDate!: string;
  @Column({ nullable: true }) assignedTo!: string;
  @Column() status!: string;
  @Column({ nullable: true }) originator!: string;
  @Column() topicType!: string;
  @Column(TEXT) description!: string;
  @Column({ nullable: true }) dueDate!: string;
  @Column({ nullable: true }) dateClosed!: string;
  @Column('int') daysOpen!: number;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) resolution!: string;
  @Column({ nullable: true }) linkedFile!: string; // legacy free-text link; superseded by `attachments`
  @Column() project!: string;
  // --- Added with task attachments / real assignment ---
  @Column({ nullable: true }) assignedToId!: string;   // users.id — `assignedTo` stays as the display name
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
  @Column({ type: 'simple-json', nullable: true }) comments!: TaskComment[];
  @Column({ type: 'simple-json', nullable: true }) activity!: ActivityEvent[];
  @Column({ type: 'simple-json', nullable: true }) checklist!: ChecklistItem[];
  @Column({ type: 'simple-json', nullable: true }) labels!: string[];
  @Column({ nullable: true }) updatedAt!: string;
}

@Entity('deals')
export class DealEntity {
  @PrimaryColumn() id!: string;
  @Column() name!: string;
  @Column() client!: string;
  @Column() value!: string;
  @Column() stage!: string;
  @Column('int') stageIdx!: number;
  @Column() assignedRole!: string;
  @Column() assignee!: string;
  @Column() assigneeInit!: string;
  @Column('int') daysInStage!: number;
  @Column() nextAction!: string;
  @Column() nextDue!: string;
  @Column() source!: string;
  @Column() status!: string;
  @Column() phone!: string;
  @Column() email!: string;
  @Column('simple-json') timeline!: unknown[];
  @Column(TEXT) notes!: string;
  // Set when the deal is parked on a hold stage: the date to pick it back up.
  @Column({ nullable: true }) holdUntil!: string;
  // Off the board without being destroyed. Only terminal stages are archivable.
  @Column({ type: 'bit', nullable: true }) archived!: boolean | null;
  @Column({ nullable: true }) archivedAt!: string;
  // Set once the lead becomes a project, so the card can leave the board.
  @Column({ type: 'int', nullable: true }) convertedProjectId!: number | null;
  // Internal team on this pursuit: { projectManager, superintendent, ... }
  @Column({ type: 'simple-json', nullable: true }) roles!: Record<string, string>;
}

@Entity('invoices')
export class InvoiceEntity {
  @PrimaryGeneratedColumn() pk!: number;
  @Column() invId!: string;
  @Column() kind!: string; // internal | client | consultant
  @Column() project!: string;
  @Column() month!: string;
  @Column() issued!: string;
  @Column('int') amount!: number;
  @Column('int') paid!: number;
}

@Entity('finance')
export class FinanceEntity {
  @PrimaryColumn() name!: string;
  @Column() exec!: string;
  @Column() contract!: string;
  @Column() labor!: string;
  @Column() phase!: string;
  @Column('int') base!: number;
  @Column('int') co!: number;
  @Column('int') reimb!: number;
  @Column('int') baseUsed!: number;
  @Column('int') coUsed!: number;
  @Column('int') reimbUsed!: number;
  @Column('int') timePct!: number;
}

@Entity('leads')
export class LeadEntity {
  @PrimaryColumn() id!: string;
  // The primary contact's name. `leadName` stays the composed display name so
  // everything downstream (deals, projects, letters) keeps working; the parts
  // are what the intake form actually collects.
  @Column() leadName!: string;
  @Column({ nullable: true }) firstName!: string;
  @Column({ nullable: true }) lastName!: string;
  @Column({ nullable: true }) goByName!: string;   // what they prefer to be called
  @Column({ nullable: true }) pronouns!: string;
  @Column({ nullable: true }) namePronunciation!: string;
  @Column() phone!: string;
  @Column({ nullable: true }) email!: string;
  @Column({ nullable: true }) primaryPointOfContact!: string;
  @Column({ nullable: true }) secondPointOfContact!: string;
  @Column({ nullable: true }) nameOfSecondContact!: string;
  @Column({ nullable: true }) phoneOfSecondContact!: string;
  @Column({ nullable: true }) emailOfSecondContact!: string;
  @Column({ nullable: true }) relationshipOfSecondContact!: string;
  // Each contact chooses how they want to be reached, so the second contact
  // has its own preference rather than inheriting the primary one.
  @Column({ nullable: true }) preferredContactMethodOfSecondContact!: string;
  @Column({ nullable: true }) pronounsOfSecondContact!: string;
  // Everyone involved in the project, each holding one or more roles
  // (PC, SC, OR, OC, ON, SH, FY, CA, C2, AD). A lead outgrows the single
  // primary/second contact pair as soon as owners and consultants appear.
  @Column({ type: 'simple-json', nullable: true }) contacts!: unknown[];
  @Column({ nullable: true }) decisionMakers!: string;
  @Column({ nullable: true }) preferredContactMethod!: string;
  @Column({ nullable: true }) leadSource!: string;
  @Column({ nullable: true }) leadSourceReferrerName!: string;  // who made the referral
  @Column({ nullable: true }) leadSourceEventDetail!: string;   // which event, or where the networking happened
  @Column({ nullable: true }) projectStreetAddress!: string;
  @Column({ nullable: true }) projectStreetName!: string;
  @Column({ nullable: true }) projectCity!: string;
  @Column({ nullable: true }) projectZipCode!: string;
  @Column({ nullable: true }) countyLocation!: string;
  @Column({ nullable: true }) hasHOA!: string;   // 'Yes' | 'No'
  @Column({ nullable: true }) propertyType!: string;
  @Column({ nullable: true }) potentialProjectType!: string;
  @Column({ nullable: true }) contractType!: string;  // DO | BO | DB | PDB
  @Column({ type: 'simple-json', nullable: true }) homeworkCompleted!: string[];
  @Column({ ...TEXT, nullable: true }) projectVision!: string;
  @Column({ nullable: true }) reasonForProject!: string;
  @Column({ nullable: true }) budgetPosition!: string;
  @Column({ nullable: true }) fundingStatus!: string;
  @Column({ nullable: true }) desiredStart!: string;
  @Column({ nullable: true }) expectedDuration!: string;
  @Column({ nullable: true }) expectedLengthOfOwnership!: string;
  @Column({ nullable: true }) clientPersonality!: string;
  @Column({ nullable: true }) virtualMeetingAt!: string;
  @Column({ nullable: true }) siteVisitAt!: string;
  @Column({ type: 'int', nullable: true }) fitScore!: number;
  @Column({ type: 'simple-json', nullable: true }) fitSelections!: Record<string, string>;
  @Column({ ...TEXT, nullable: true }) zoningImages!: string; // JSON string of [{name,dataUrl}] (data URLs)
  @Column({ ...TEXT, nullable: true }) zoningAnalysis!: string; // JSON string of the Zoning Code Analysis field map
  @Column() createdAt!: string;
}

@Entity('scoring_criteria')
export class ScoringCriterionEntity {
  @PrimaryColumn() key!: string;
  @Column('int') order!: number;
  @Column() name!: string;
  @Column({ nullable: true }) subCriteria!: string;
  @Column('int') maxPoints!: number;
  @Column('simple-json') options!: { label: string; points: number }[];
}

@Entity('roles')
export class RoleEntity {
  @PrimaryColumn() key!: string;
  @Column() name!: string;
  @Column({ nullable: true }) description!: string;
  @Column() tier!: string; // internal | client | consultant
  @Column('int') order!: number;
  @Column({ default: false }) isSystem!: boolean;
  // moduleKey -> { view, manage }
  @Column('simple-json') permissions!: Record<string, { view: boolean; manage: boolean }>;
}

@Entity('tickets')
export class TicketEntity {
  @PrimaryColumn() id!: string;
  @Column() subject!: string;
  @Column({ nullable: true }) category!: string;
  @Column({ nullable: true }) priority!: string; // Low | Medium | High | Urgent
  @Column(TEXT) message!: string;
  @Column({ nullable: true }) requesterName!: string;
  @Column({ nullable: true }) requesterEmail!: string;
  @Column() status!: string; // Open | In Progress | Resolved
  @Column() createdAt!: string;
}

@Entity('faqs')
export class FaqEntity {
  @PrimaryColumn() id!: string;
  @Column() question!: string;
  @Column(TEXT) answer!: string;
  @Column({ nullable: true }) category!: string;
  @Column('int') order!: number;
}

@Entity('email_templates')
export class EmailTemplateEntity {
  @PrimaryColumn() id!: string;
  @Column({ nullable: true }) key!: string;       // stable slug, e.g. introduction_letter
  @Column() name!: string;
  @Column({ ...TEXT, nullable: true }) subject!: string;
  @Column(TEXT) body!: string;                     // may contain {{token}} merge fields
  @Column({ nullable: true }) kind!: string;       // email | document
  @Column({ nullable: true }) category!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

@Entity('workflows')
export class WorkflowEntity {
  @PrimaryColumn() id!: string;
  @Column({ type: 'int', nullable: true }) projectId!: number; // null = template / unassigned
  @Column() name!: string;
  @Column({ ...TEXT, nullable: true }) description!: string;
  @Column() status!: string; // Active | Draft | Archived
  @Column({ nullable: true }) owner!: string;
  @Column({ type: 'int', nullable: true }) estimatedDays!: number; // estimated time
  @Column({ nullable: true }) plannedStart!: string; // plan time
  @Column({ nullable: true }) plannedEnd!: string;   // plan time
  @Column({ nullable: true }) completedAt!: string;  // completed time
  @Column() createdAt!: string;
}

@Entity('workflow_items')
export class WorkflowItemEntity {
  @PrimaryColumn() id!: string;
  @Column() workflowId!: string;
  @Column() title!: string;
  @Column() status!: string; // Open | In Progress | Done
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column('int') order!: number;
  @Column({ type: 'int', nullable: true }) estimatedDays!: number; // estimated time
  @Column({ nullable: true }) plannedStart!: string; // plan time
  @Column({ nullable: true }) plannedEnd!: string;   // plan time
  @Column({ nullable: true }) completedAt!: string;  // completed time
  @Column() createdAt!: string;
}

@Entity('project_sections')
export class ProjectSectionEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column() name!: string;
  @Column('int') order!: number;
}

@Entity('project_tasks')
export class ProjectTaskEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column() sectionId!: string;
  @Column() title!: string;
  @Column({ ...TEXT, nullable: true }) description!: string;
  @Column({ nullable: true }) assignee!: string;
  @Column({ nullable: true }) dueDate!: string;
  @Column({ nullable: true }) priority!: string; // Low | Medium | High | Urgent
  @Column('int') order!: number;
  @Column({ default: false }) completed!: boolean;
  @Column({ nullable: true }) parentId!: string; // subtask -> parent task id
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
  @Column({ type: 'simple-json', nullable: true }) comments!: TaskComment[];
  @Column() createdAt!: string;
  // --- Added with task attachments / real assignment ---
  @Column({ nullable: true }) assigneeId!: string;     // users.id — `assignee` stays as the display name
  @Column({ nullable: true }) status!: string;         // Not started | In progress | Blocked | Done
  @Column({ type: 'simple-json', nullable: true }) checklist!: ChecklistItem[];
  @Column({ type: 'simple-json', nullable: true }) labels!: string[];
  @Column({ type: 'simple-json', nullable: true }) activity!: ActivityEvent[];
  @Column({ nullable: true }) updatedAt!: string;
  // --- Phase Board ---
  @Column({ nullable: true }) phaseId!: string;        // null = ad-hoc task, lives on the kanban
  @Column({ nullable: true }) team!: string;           // Architecture, Permits & Compliance, ...
  @Column({ nullable: true, default: false }) auto!: boolean; // work that should eventually be automated
  @Column({ nullable: true }) autoLabel!: string;
  @Column({ nullable: true }) startDate!: string;      // ISO
  @Column({ nullable: true }) endDate!: string;        // ISO; '' when open-ended
  @Column({ type: 'int', nullable: true }) durationDays!: number;
  @Column({ type: 'simple-json', nullable: true }) dependsOn!: string[]; // task ids
}

/**
 * A stage of the delivery programme. Created empty for every project on first
 * view; tasks are added into it by the team running that project.
 */
@Entity('project_phases')
export class ProjectPhaseEntity {
  @PrimaryColumn() id!: string;      // PH-<projectId>-<key>
  @Column('int') projectId!: number;
  @Column() key!: string;
  @Column() name!: string;
  @Column() color!: string;
  @Column('int') order!: number;
  @Column({ nullable: true }) startDate!: string;
  @Column({ nullable: true }) endDate!: string;
  // Set once the standard checklist has been laid down, so deliberately
  // clearing a phase is not undone on the next boot.
  @Column({ nullable: true }) seededAt!: string;
}

@Entity('users')
export class UserEntity {
  @PrimaryColumn() id!: string;
  @Column() name!: string;
  @Column() email!: string;
  @Column() tier!: string; // internal | client | consultant
  @Column() roleKey!: string;
  @Column() status!: string; // pending | active | suspended
  @Column({ nullable: true }) lastLogin!: string;
  @Column() createdAt!: string;
  // --- Authentication (never sent to the client; stripped in UsersService) ---
  @Column({ nullable: true }) passwordHash!: string;   // scrypt: salt:hash
  @Column({ nullable: true }) passwordSetAt!: string;
  @Column({ nullable: true }) googleId!: string;       // Google "sub" once they sign in with Google
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) avatarUrl!: string;
  @Column({ nullable: true }) inviteToken!: string;    // sha256 of the emailed token
  @Column({ nullable: true }) inviteSentAt!: string;
  @Column({ nullable: true }) inviteExpiresAt!: string;
  // --- Preferences ---
  // Null means "not chosen", which reads as on: an existing account should keep
  // being told when work is assigned to them without opting in first.
  @Column({ type: 'bit', nullable: true }) notifyOnAssignment!: boolean | null;
}

// Simple key/value store for workspace configuration (Google OAuth credentials,
// the app base URL, the signing secret …). Secrets are never returned in full.
@Entity('app_settings')
export class AppSettingEntity {
  @PrimaryColumn() key!: string;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) value!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

/**
 * A file in the File Room. The bytes live in the connected Google Drive; this
 * row holds where it sits in the folder tree and which version group it belongs
 * to. `folderPath` excludes the project itself — ['Drawings & Plans', 'Rev 4'].
 */
@Entity('file_room_files')
export class FileRoomFileEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column({ type: 'simple-json', nullable: true }) folderPath!: string[];
  @Column() name!: string;
  @Column({ nullable: true }) ext!: string;
  @Column({ type: 'bigint', nullable: true }) size!: number;
  @Column({ nullable: true }) mimeType!: string;
  @Column({ nullable: true }) driveId!: string;
  @Column({ nullable: true }) uploadedBy!: string;
  @Column({ nullable: true }) uploadedById!: string;
  @Column({ nullable: true }) updatedAt!: string;
  /** Revisions of the same document share a group; one of them is the latest. */
  @Column({ nullable: true }) groupId!: string;
  @Column({ nullable: true, default: true }) isLatest!: boolean;
  /** Free notes about the document — what it is, what changed, what to watch. */
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) notes!: string;
}

/** A folder someone created that holds no files yet — otherwise it would vanish. */
@Entity('file_room_folders')
export class FileRoomFolderEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column({ type: 'simple-json', nullable: true }) path!: string[];   // includes its own name
  @Column() name!: string;
  @Column({ nullable: true }) createdAt!: string;
}
