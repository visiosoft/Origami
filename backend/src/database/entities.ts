import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';
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
  // The composed Introduction Letter, saved as a draft before it's sent --
  // separate from the plain-text template default, so an edit survives a
  // reload instead of re-merging from the template every time the tab opens.
  @Column({ nullable: true }) introLetterSubject!: string;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) introLetterHtml!: string;
  // Set once the client has signed. Locks the AEC Team roster in the Project
  // Program against further edits -- it's assembled provisionally during
  // programming, but who's actually on the job is only final once there's a
  // signed contract to hold them to.
  @Column({ type: 'bit', nullable: true }) contractApproved!: boolean | null;
  // Which entry of the programme template library (settings key
  // 'programme.templates') this project's Phase Board is built from -- a
  // kitchen remodel and a ground-up build don't share one shape. Unset falls
  // back to the library's first entry.
  @Column({ nullable: true }) templateKey!: string;
  @Column({ nullable: true }) website!: string; // rolls over from the originating lead at conversion
  /** True when the project doesn't use the Project Program workbook (outsourced, software, small jobs); its answers are kept. */
  @Column({ nullable: true, default: false }) programOff!: boolean;
  // On hold: parked without leaving its stage, with a follow-up task (holdTaskId)
  // for whoever picks it back up on holdUntil. Empty holdSince = active.
  @Column({ nullable: true }) holdSince!: string;
  @Column({ nullable: true }) holdUntil!: string;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) holdReason!: string;
  @Column({ nullable: true }) holdBy!: string;
  @Column({ nullable: true }) holdTaskId!: string;
  /** Every hold, change and resume, oldest first. */
  @Column({ type: 'simple-json', nullable: true }) holdHistory!: { action: 'hold' | 'changed' | 'resumed'; at: string; by: string; until?: string; reason?: string; followUp?: string }[] | null;
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
  /** Set for staff and contractor workers: the Manpower employee this entry is (one record, two views). */
  @Column({ nullable: true }) employeeId!: string;
  @Column() since!: string;
  @Column({ type: 'simple-json', nullable: true }) comply!: unknown;
  @Column() last!: string;

  // --- Profile ---
  // `name` stays the display name; these are the parts it is composed from.
  @Column({ nullable: true }) firstName!: string;
  @Column({ nullable: true }) lastName!: string;
  @Column({ nullable: true }) goByName!: string;
  @Column({ nullable: true }) pronouns!: string;
  @Column({ nullable: true }) gender!: string;          // Male | Female | Unknown
  // Which directories this person belongs to. Someone on staff who also runs a
  // consultancy is both, so this is a list rather than the single `kind`.
  @Column({ type: 'simple-json', nullable: true }) categories!: string[];
  // { project, billing, home, business, businessMailing }, each with its parts
  // and a notApplicable flag.
  @Column({ type: 'simple-json', nullable: true }) addresses!: Record<string, unknown>;
  // Websites, social, business phone and email.
  @Column({ type: 'simple-json', nullable: true }) contactInfo!: Record<string, unknown>;
  // Every licence held, of any discipline and any state — people hold several.
  @Column({ type: 'simple-json', nullable: true }) licenses!: unknown[];
  @Column({ type: 'simple-json', nullable: true }) insurance!: Record<string, unknown>;
  // A designer who may take residential work but not commercial.
  @Column({ type: 'bit', nullable: true }) notLicensedDesigner!: boolean | null;
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
  // HH:mm, set when a task is created from a specific slot on My Calendar --
  // absent means "sometime that day", same as before this existed.
  @Column({ nullable: true }) dueTime!: string;
  @Column({ nullable: true }) dateClosed!: string;
  @Column('int') daysOpen!: number;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) resolution!: string;
  @Column({ nullable: true }) linkedFile!: string; // legacy free-text link; superseded by `attachments`
  @Column() project!: string;
  // --- Added with task attachments / real assignment ---
  @Column({ nullable: true }) assignedToId!: string;   // users.id — `assignedTo` stays as the display name
  /** People following the task without owning it ("Collaborative"): [{ id, name }]. */
  @Column({ type: 'simple-json', nullable: true }) collaborators!: { id: string; name: string }[];
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
  // name/client/phone/email used to live here too, independently of the
  // matching LeadEntity row -- the two copies drifted out of sync whenever
  // one was updated without the other (the "Kellen Davies"/"Qamaria Coffee"/
  // "Neon Project" bug). The lead is now the sole source of truth for these
  // fields; PipelineService overlays them from the lead at read time.
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
  @Column('simple-json') timeline!: unknown[];
  @Column(TEXT) notes!: string;
  // Set when the deal is parked on a hold stage: the date to pick it back up.
  // When the deal entered its current stage — the clock the response-time
  // target is measured from.
  @Column({ nullable: true }) stageEnteredAt!: string;
  @Column({ nullable: true }) holdUntil!: string;
  // Off the board without being destroyed. Only terminal stages are archivable.
  @Column({ type: 'bit', nullable: true }) archived!: boolean | null;
  @Column({ nullable: true }) archivedAt!: string;
  // Set once the lead becomes a project, so the card can leave the board.
  @Column({ type: 'int', nullable: true }) convertedProjectId!: number | null;
  // Internal team on this pursuit: { projectManager, superintendent, ... }
  @Column({ type: 'simple-json', nullable: true }) roles!: Record<string, string>;
  // Chases made on this lead: how, to whom, what came of it.
  @Column({ type: 'simple-json', nullable: true }) followUps!: unknown[];
  // Stage notes. Held here rather than only in the browser, which is where
  // they used to live -- and where they were lost on every reload.
  @Column({ type: 'simple-json', nullable: true }) stageNotes!: unknown[];
  // Set when a deal is closed as rejected -- which of the three outcomes, and
  // (for a referral) who the lead was handed off to. Nullable: only set once a
  // deal is actually rejected, and this table already has rows.
  @Column({ nullable: true }) rejectionType!: string; // 'internal' | 'client' | 'referred'
  @Column({ nullable: true }) rejectionReason!: string;
  @Column({ nullable: true }) referredToName!: string;
  @Column({ nullable: true }) referredToCompany!: string;
  @Column({ nullable: true }) referredToContact!: string;
}

/**
 * The proposal/contract sent to a lead for e-signature -- one per deal.
 *
 * Signing it is the "formal contract signature" the rest of the CRM treats
 * as the moment a lead becomes a real job: the signing endpoint is what
 * triggers PipelineService.convertToProject. signedAt/signerIp/signerUserAgent
 * are always the server's own record of the request, never anything the
 * signer's browser claims.
 */
@Entity('proposals')
export class ProposalEntity {
  @PrimaryColumn() dealId!: string;
  @Column({ nullable: true }) subject!: string;
  @Column('nvarchar', { length: 'MAX', nullable: true }) html!: string;
  @Column({ nullable: true }) amount!: string;
  @Column({ nullable: true }) updatedAt!: string;
  @Column({ nullable: true }) updatedBy!: string;
  @Column({ nullable: true }) sentAt!: string;
  @Column({ nullable: true }) sentTo!: string;
  @Column({ nullable: true }) signedAt!: string;
  @Column({ nullable: true }) signedByName!: string;
  @Column({ nullable: true }) signedByEmail!: string;
  @Column('nvarchar', { length: 'MAX', nullable: true }) signatureImage!: string;
  @Column({ nullable: true }) signerIp!: string;
  @Column({ nullable: true }) signerUserAgent!: string;
  // Confirms the signer scrolled through and reviewed the whole document,
  // not just the signature block -- the checkbox alternative to a client
  // initialing every physical page (which a paginated PDF can't reliably ask
  // for, since exact page breaks aren't known until Google renders it).
  @Column({ type: 'bit', nullable: true }) reviewedAllPages!: boolean | null;
  // Set when sending, for an agreement that needs a second signatory (e.g. a
  // husband and wife) -- both signature fields below must be filled before
  // the agreement counts as signed.
  @Column({ type: 'bit', nullable: true }) requiresSecondSignatory!: boolean | null;
  @Column({ nullable: true }) signedAt2!: string;
  @Column({ nullable: true }) signedByName2!: string;
  @Column({ nullable: true }) signedByEmail2!: string;
  @Column('nvarchar', { length: 'MAX', nullable: true }) signatureImage2!: string;
  @Column({ nullable: true }) signerIp2!: string;
  @Column({ nullable: true }) signerUserAgent2!: string;
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
  // The business/entity this lead represents, distinct from the contact
  // person's name above. Optional -- blank falls back to leadName wherever
  // DealEntity.client is set, same as before this field existed.
  @Column({ nullable: true }) businessName!: string;
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
  // The fixed "second contact" fields above are legacy -- kept so old leads
  // still read correctly, but no longer edited. Replaced by this repeatable
  // list: same columns as the primary contact, as many as the lead needs.
  @Column({ type: 'simple-json', nullable: true }) additionalContacts!: unknown[];
  // Roles the primary contact holds beyond just being the primary contact --
  // e.g. also the Owner, also the Approver -- picked at intake, same codes as
  // the Contacts tab's Roles picker.
  @Column({ type: 'simple-json', nullable: true }) primaryContactRoles!: string[];
  // Every intake section carries its own free-text notes and ad-hoc
  // label/value fields, keyed by the section's stable key (see LEAD_SECTIONS
  // on the frontend) rather than its numbered title.
  @Column({ type: 'simple-json', nullable: true }) sectionNotes!: Record<string, string>;
  @Column({ type: 'simple-json', nullable: true }) sectionCustomFields!: Record<string, unknown[]>;
  // Everyone involved in the project, each holding one or more roles
  // (PC, SC, OR, OC, ON, SH, FY, CA, C2, AD). A lead outgrows the single
  // primary/second contact pair as soon as owners and consultants appear.
  @Column({ type: 'simple-json', nullable: true }) contacts!: unknown[];
  /**
   * Who the client is, for rapport -- kept apart from project notes: a few
   * facts ({ business, family, from, interests, ... }) and dated notes
   * ([{ id, text, at, by }]). Raw notes stay as written; any AI summary is an
   * overlay on top, never a replacement.
   */
  @Column({ type: 'simple-json', nullable: true }) clientBackground!: { facts?: Record<string, string>; notes?: { id: string; text: string; at: string; by?: string }[] };
  @Column({ nullable: true }) decisionMakers!: string;
  @Column({ nullable: true }) preferredContactMethod!: string;
  // How they want to be reached, per method: Primary | Secondary | No.
  // preferredContactMethod stays the single headline answer derived from it.
  @Column({ type: 'simple-json', nullable: true }) preferredContactMatrix!: Record<string, string>;
  @Column({ nullable: true }) leadSource!: string;
  @Column({ nullable: true }) leadSourceReferrerName!: string;  // who made the referral
  @Column({ nullable: true }) leadSourceReferrerPhone!: string; // and how to reach them
  @Column({ nullable: true }) leadSourceEventDetail!: string;   // which event, or where the networking happened
  @Column({ nullable: true }) projectStreetAddress!: string;
  @Column({ nullable: true }) projectStreetName!: string;
  @Column({ nullable: true }) projectAddress2!: string;   // unit, suite, floor
  @Column({ nullable: true }) occupancyStatus!: string;   // owner, tenant, and so on
  @Column({ nullable: true }) projectCity!: string;
  @Column({ nullable: true }) projectZipCode!: string;
  @Column({ nullable: true }) countyLocation!: string;
  @Column({ nullable: true }) hasHOA!: string;   // 'Yes' | 'No'
  // A mailing address distinct from the project site -- the correspondence
  // address for the legal entity, not the work address. Keyed by kind
  // ('businessMailing', 'billing' for an optional third address), same shape
  // as PersonEntity.addresses below, reusing frontend's Address/ADDRESS_KINDS
  // rather than a second address type. The flat project-site fields above are
  // deliberately left alone -- this only covers the *new* mailing address.
  @Column({ type: 'simple-json', nullable: true }) addresses!: Record<string, unknown>;
  @Column({ nullable: true }) propertyType!: string;
  @Column({ nullable: true }) potentialProjectType!: string;
  @Column({ nullable: true }) contractType!: string;  // DO | BO | DB | PDB
  // Free text for any field answered 'Other', keyed by that field's name —
  // a column per dropdown would be six columns that are almost always null.
  @Column({ type: 'simple-json', nullable: true }) otherDetails!: Record<string, string>;
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
  // The virtual meeting's kind -- 'video' (the existing Google Meet flow) or
  // 'phone' (no video, no location, just a call and an agenda). Site visits
  // are always in person, so they don't need this.
  @Column({ nullable: true }) meetingType!: string;
  @Column({ ...TEXT, nullable: true }) meetingAgenda!: string;
  // The real Calendar event id once one is created -- lets a re-save update
  // the same event instead of leaving duplicates on the calendar.
  @Column({ nullable: true }) meetingEventId!: string;
  @Column({ type: 'int', nullable: true }) fitScore!: number;
  @Column({ type: 'simple-json', nullable: true }) fitSelections!: Record<string, string>;
  @Column({ ...TEXT, nullable: true }) zoningImages!: string; // JSON string of [{name,dataUrl}] (data URLs)
  @Column({ ...TEXT, nullable: true }) zoningAnalysis!: string; // JSON string of the Zoning Code Analysis field map
  @Column({ nullable: true }) website!: string;
  // Set on every successful write; compared against the client's
  // expectedUpdatedAt to catch a save that started from a stale copy.
  // Nullable so existing rows (written before this existed) don't fail
  // the check -- see LeadsService.update().
  @Column({ nullable: true }) updatedAt!: string;
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

@Entity('consultants')
export class ConsultantEntity {
  @PrimaryColumn() id!: string;
  @Column() type!: string;
  @Column() firm!: string;
  @Column({ nullable: true }) address!: string;
  @Column({ nullable: true }) contact!: string;
  @Column({ nullable: true }) phone!: string;
  @Column({ nullable: true }) email!: string;
  @Column({ default: false }) rfpSent!: boolean;
  @Column({ default: false }) bidInterest!: boolean;
  @Column({ nullable: true }) proposalAmount!: string;
  @Column({ default: false }) signedContract!: boolean;
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
  // Null = the "General Tasks" board's sections -- work not tied to any
  // client project, rather than only ever living project-scoped.
  @Column({ type: 'int', nullable: true }) projectId!: number | null;
  @Column() name!: string;
  @Column('int') order!: number;
}

@Entity('project_tasks')
export class ProjectTaskEntity {
  @PrimaryColumn() id!: string;
  // Null = a General Tasks board task, not tied to any client project.
  @Column({ type: 'int', nullable: true }) projectId!: number | null;
  @Column({ nullable: true }) sectionId!: string;
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
  /** People following the task without owning it ("Collaborative"): [{ id, name }]. */
  @Column({ type: 'simple-json', nullable: true }) collaborators!: { id: string; name: string }[];
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
  // Fire-once stamps for the 50/90/100% completion notifications -- same
  // idiom as seededAt above. Null means that threshold hasn't been crossed
  // (or the notification hasn't been sent for it) yet; once stamped it never
  // refires, even if the phase later drops back under the threshold and
  // crosses it again.
  // Plain `string`, not `string | null` -- TypeORM reflects a union type as
  // "Object" and can't map that to a column type without an explicit `type`,
  // which is exactly what took the whole app down after this was shipped as
  // `string | null`. `nullable: true` alone gives the DB-level nullability;
  // every other nullable string column in this file follows that pattern.
  @Column({ nullable: true }) notified50!: string;
  @Column({ nullable: true }) notified90!: string;
  @Column({ nullable: true }) notified100!: string;
  /**
   * Set when a project doesn't use this phase (e.g. the design programme on a
   * software job). Hidden phases keep their tasks and can be shown again; the
   * row stays so the template never re-adds them.
   */
  @Column({ nullable: true }) hiddenAt!: string;
}

/**
 * The Project Program a job's early work produces -- the workbook the office
 * used to keep per project, one wizard step per sheet.
 *
 * Stored as one JSON document rather than a column per question: the form is
 * edited in the app and grows a field at a time, and a hundred nullable
 * columns would need a schema change for each one.
 */
@Entity('project_programs')
export class ProjectProgramEntity {
  @PrimaryColumn('int') projectId!: number;
  @Column('nvarchar', { length: 'MAX', nullable: true }) data!: string;
  @Column({ nullable: true }) updatedAt!: string;
  @Column({ nullable: true }) updatedBy!: string;
  @Column({ nullable: true }) completedAt!: string;
  @Column({ nullable: true }) sentAt!: string;
  @Column({ nullable: true }) sentTo!: string;
  // The client's e-signature. Timestamp, IP and user agent are always the
  // server's own record of the request, never anything the client claims --
  // that's what makes this worth calling a certification.
  @Column({ nullable: true }) signedAt!: string;
  @Column({ nullable: true }) signedByName!: string;
  @Column({ nullable: true }) signedByEmail!: string;
  @Column('nvarchar', { length: 'MAX', nullable: true }) signatureImage!: string; // base64 PNG from the pad
  @Column({ nullable: true }) signerIp!: string;
  @Column({ nullable: true }) signerUserAgent!: string;
}

/**
 * The same Project Program document, held against a lead instead of a
 * project -- the programme is produced before a lead converts, so the
 * document needs a home on that side of the line too. A separate table
 * rather than reusing ProjectProgramEntity with a shared id space: leads use
 * string ids ('LD-001'), projects use numeric ones, and keeping them apart
 * means a project id can never collide with a lead id.
 */
@Entity('lead_programs')
export class LeadProgramEntity {
  @PrimaryColumn() leadId!: string;
  @Column('nvarchar', { length: 'MAX', nullable: true }) data!: string;
  @Column({ nullable: true }) updatedAt!: string;
  @Column({ nullable: true }) updatedBy!: string;
  @Column({ nullable: true }) completedAt!: string;
  @Column({ nullable: true }) sentAt!: string;
  @Column({ nullable: true }) sentTo!: string;
}

/**
 * A time-limited login granted to an external client or consultant, instead
 * of a permanent password account -- the office's alternative to emailing
 * out standing credentials. Logs in as a real (passwordless) UserEntity row
 * so the rest of the app needs no separate guest code path; expiry and
 * revocation are enforced here, off the grant, each time the link resolves.
 */
@Entity('guest_access')
export class GuestAccessEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column() userId!: string;
  @Column('int') projectId!: number;
  @Column() createdAt!: string;
  @Column() expiresAt!: string;
  @Column({ nullable: true }) createdBy!: string;
  @Column({ nullable: true }) revokedAt!: string;
  @Column({ nullable: true }) lastUsedAt!: string;
}

/**
 * A snapshot of a Project Program document taken on every save, so the
 * living document has a history as requirements evolve rather than only the
 * current answers. One table serves both projects and leads -- a version is
 * an inert timestamped copy, not a live row with its own foreign-key needs --
 * keyed by `ownerKey`: 'project:<id>' or 'lead:<id>'.
 */
@Entity('project_program_versions')
export class ProjectProgramVersionEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column() ownerKey!: string;
  @Column('nvarchar', { length: 'MAX', nullable: true }) data!: string;
  @Column() savedAt!: string;
  @Column({ nullable: true }) savedBy!: string;
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
  // Notification preferences beyond assignment -- flat nullable columns, one
  // bit per preference, matching notifyOnAssignment above rather than a JSON
  // blob (which would be the first of its kind on this entity). Null reads as
  // the documented default for each: on for email/overdue/milestone, off for
  // SMS (it costs money per message; nobody should be opted in silently).
  @Column({ type: 'bit', nullable: true }) notifyByEmail!: boolean | null;
  @Column({ type: 'bit', nullable: true }) notifyBySms!: boolean | null;
  @Column({ nullable: true }) digestFrequency!: string; // 'daily' | 'weekly' | 'off'
  @Column({ type: 'bit', nullable: true }) notifyOnOverdue!: boolean | null;
  @Column({ type: 'bit', nullable: true }) notifyOnMilestone!: boolean | null;
  // A staff member's OWN Google Calendar -- separate from the one shared
  // workspace connection everything else in this file (mail, Drive, the
  // office-wide calendars checked while booking) uses. Scoped to
  // calendar.events only: Origami can create/update events this person makes
  // from My Calendar, but never reads or touches their calendar list.
  // Never returned to the client -- see publicUser() in auth.service.
  @Column({ nullable: true }) calendarRefreshToken!: string;
  @Column({ nullable: true }) calendarEmail!: string;
  @Column({ nullable: true }) calendarConnectedAt!: string;
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

// ---------------------------------------------------------------- Manpower

/** A field worker or staff member tracked for labor logging -- not necessarily an app login. */
@Entity('employees')
export class EmployeeEntity {
  @PrimaryColumn() id!: string;
  @Column() name!: string;
  @Column({ nullable: true }) jobTitle!: string;
  @Column({ nullable: true }) trade!: string;
  @Column({ type: 'simple-json', nullable: true }) expertise!: string[];
  @Column({ nullable: true }) payType!: string; // hourly | salary
  @Column({ type: 'float', nullable: true }) payRate!: number;
  @Column({ nullable: true }) phone!: string;
  @Column({ nullable: true }) email!: string;
  @Column({ nullable: true }) hireDate!: string;
  @Column({ default: 'active' }) status!: string; // active | inactive -- superseded by employmentStatus
  /** Who this employee reports to -- the org/reporting layer, independent of any project assignment. */
  @Column({ nullable: true }) supervisorId!: string;
  /** Set when this employee also has an app login (e.g. every Supervisor). */
  @Column({ nullable: true }) userId!: string;
  @Column() createdAt!: string;

  // --- Employee master ---
  /** Human-facing worker number printed on cards and payslips, distinct from the internal id. */
  @Column({ nullable: true }) workerId!: string;
  @Column({ nullable: true }) fatherOrSpouseName!: string;
  @Column({ nullable: true }) nationalId!: string; // CNIC / passport / national ID
  @Column({ nullable: true }) dob!: string;
  @Column({ nullable: true }) gender!: string;
  @Column({ nullable: true }) emergencyContactName!: string;
  @Column({ nullable: true }) emergencyContactPhone!: string;
  @Column({ nullable: true }) emergencyContactRelation!: string;
  @Column({ ...TEXT, nullable: true }) permanentAddress!: string;
  @Column({ ...TEXT, nullable: true }) currentAddress!: string;
  @Column({ type: 'simple-json', nullable: true }) photo!: TaskAttachment | null;
  @Column({ nullable: true }) employmentType!: string; // permanent | contract | daily_wage | temporary | intern
  @Column({ nullable: true }) department!: string;
  @Column({ nullable: true }) designation!: string;
  @Column({ nullable: true }) grade!: string;
  /** active | on_leave | suspended | resigned | terminated | contract_expired | demobilized */
  @Column({ nullable: true }) employmentStatus!: string;
  @Column({ nullable: true }) hrOfficerId!: string;
  @Column({ nullable: true }) bankName!: string;
  @Column({ nullable: true }) bankAccount!: string;
  @Column({ nullable: true }) taxNumber!: string;
  // --- US payroll & tax ---
  @Column({ nullable: true }) bankRoutingNumber!: string;
  /** W-4 federal filing status: single | married_jointly | head_of_household */
  @Column({ nullable: true }) filingStatus!: string;
  /** Two-letter state whose income tax is withheld, e.g. CA. */
  @Column({ nullable: true }) taxState!: string;
  /** FLSA: non_exempt (overtime applies) | exempt */
  @Column({ nullable: true }) flsaStatus!: string;
  @Column({ nullable: true }) workersCompClass!: string;
  // --- Worker skills ---
  @Column({ nullable: true }) tradeId!: string;
  @Column({ nullable: true }) skillLevel!: string; // helper | semi_skilled | skilled | expert
  @Column({ type: 'float', nullable: true }) yearsExperience!: number;
  @Column({ type: 'simple-json', nullable: true }) equipmentCapabilities!: string[];
  @Column({ nullable: true }) updatedAt!: string;
  // --- Contractor workforce ---
  /** Set for a subcontractor's worker: same record, profile and deployment as staff, supplied by that company. */
  @Column({ nullable: true }) contractorId!: string;
  @Column({ nullable: true }) siteAccessStatus!: string; // pending | granted | revoked
  // --- Pay setup ---
  /** Per-employee values for configurable pay components: an amount, or a percentage for percent-based ones. */
  @Column({ type: 'simple-json', nullable: true }) payComponents!: { componentId: string; value: number }[];
  /** Hourly base for overtime when it differs from the rate derived from their pay. */
  @Column({ type: 'float', nullable: true }) overtimeRate!: number;
}

/** A configurable earning or deduction -- allowances, tax, social security -- rather than hardcoded rules. */
@Entity('pay_components')
export class PayComponentEntity {
  @PrimaryColumn() id!: string;
  @Column() name!: string;
  @Column() kind!: string;         // earning | deduction
  @Column() calcType!: string;     // fixed | percent_basic | percent_gross
  @Column({ type: 'float', default: 0 }) defaultValue!: number;
  @Column({ default: 'all' }) appliesTo!: string; // all | monthly | daily
  @Column({ nullable: true }) category!: string;  // allowance | tax | social_security | insurance | other
  @Column({ default: true }) active!: boolean;
  @Column('int') order!: number;
}

export interface PayLine {
  id: string;
  name: string;
  kind: 'earning' | 'deduction';
  /** basic | wages | overtime | component | manual | advance | loan */
  source: string;
  amount: number;
  componentId?: string;
  refIds?: string[];
  note?: string;
}

/** One pay period's run. Once finalized it is frozen: payslips carry their own snapshot of the employee. */
@Entity('payroll_runs')
export class PayrollRunEntity {
  @PrimaryColumn() id!: string;
  @Column() label!: string;
  @Column() periodStart!: string;
  @Column() periodEnd!: string;
  @Column({ default: 'all' }) payGroup!: string; // all | monthly | daily
  @Column({ default: 'draft' }) status!: string;  // draft | finalized | void
  @Column({ type: 'simple-json', nullable: true }) totals!: { headcount: number; gross: number; deductions: number; net: number; paid: number };
  @Column({ type: 'simple-json', nullable: true }) settingsSnapshot!: Record<string, unknown>;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ nullable: true }) createdByName!: string;
  @Column() createdAt!: string;
  @Column({ nullable: true }) finalizedByName!: string;
  @Column({ nullable: true }) finalizedAt!: string;
  @Column({ nullable: true }) voidedByName!: string;
  @Column({ nullable: true }) voidedAt!: string;
  @Column({ ...TEXT, nullable: true }) voidReason!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

@Entity('payslips')
export class PayslipEntity {
  @PrimaryColumn() id!: string;
  @Column() runId!: string;
  @Column() employeeId!: string;
  /** The employee as they were when this was calculated -- later edits to the master record don't rewrite history. */
  @Column({ type: 'simple-json' }) employee!: Record<string, unknown>;
  /** What the pay was worked out from: days, hours, rates, and whether any were entered by hand. */
  @Column({ type: 'simple-json' }) basis!: Record<string, unknown>;
  @Column({ type: 'simple-json' }) lines!: PayLine[];
  @Column({ type: 'float' }) gross!: number;
  @Column({ type: 'float' }) deductions!: number;
  @Column({ type: 'float' }) net!: number;
  @Column({ default: 'unpaid' }) paymentStatus!: string; // unpaid | paid
  @Column({ nullable: true }) paidAt!: string;
  @Column({ nullable: true }) paymentMethod!: string;
  @Column({ nullable: true }) paymentRef!: string;
  @Column({ nullable: true }) paidByName!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

/** Overtime asked for and approved before it is paid -- not derived from attendance. */
@Entity('overtime_requests')
export class OvertimeRequestEntity {
  @PrimaryColumn() id!: string;
  @Column() employeeId!: string;
  @Column({ type: 'int', nullable: true }) projectId!: number;
  @Column() date!: string;
  @Column({ type: 'float' }) hours!: number;
  @Column({ default: 'normal' }) otType!: string; // normal | weekend | holiday | night
  /** Hourly base override for this request; otherwise the employee's. */
  @Column({ type: 'float', nullable: true }) rate!: number;
  @Column({ ...TEXT, nullable: true }) reason!: string;
  @Column({ default: 'pending' }) status!: string; // pending | approved | rejected | cancelled
  @Column({ default: 'manual' }) source!: string;  // manual | daily_log
  @Column({ nullable: true }) requestedById!: string;
  @Column({ nullable: true }) requestedByName!: string;
  @Column({ nullable: true }) decidedByName!: string;
  @Column({ nullable: true }) decidedAt!: string;
  @Column({ ...TEXT, nullable: true }) decisionNote!: string;
  // Fixed at approval, so a later rate change doesn't reprice approved overtime.
  @Column({ type: 'float', nullable: true }) baseRate!: number;
  @Column({ type: 'float', nullable: true }) multiplier!: number;
  @Column({ type: 'float', nullable: true }) amount!: number;
  @Column({ nullable: true }) payrollRunId!: string;
  @Column() createdAt!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

export interface AdvanceApproval { stage: string; decision: 'approved' | 'rejected'; byName: string; byId?: string; at: string; note?: string }
export interface AdvanceRepayment { id: string; date: string; amount: number; method: 'payroll' | 'manual'; runId?: string; payslipId?: string; byName?: string; note?: string }

/** A salary advance or loan: approved manager -> HR -> finance, paid out, then recovered in instalments. */
@Entity('employee_advances')
export class EmployeeAdvanceEntity {
  @PrimaryColumn() id!: string;
  @Column() employeeId!: string;
  @Column() type!: string; // salary_advance | emergency_advance | loan | travel_advance | project_advance
  @Column({ type: 'float' }) amount!: number;
  @Column() requestDate!: string;
  @Column({ ...TEXT, nullable: true }) reason!: string;
  @Column('int') installments!: number;
  @Column({ type: 'float' }) installmentAmount!: number;
  /** Recovery starts with the first payroll period that ends on or after this date. */
  @Column() deductionStart!: string;
  /** pending_manager | pending_hr | pending_finance | approved | disbursed | settled | rejected | cancelled */
  @Column() status!: string;
  @Column({ type: 'simple-json' }) approvals!: AdvanceApproval[];
  @Column({ nullable: true }) disbursedAt!: string;
  @Column({ nullable: true }) disbursedByName!: string;
  @Column({ nullable: true }) paymentMethod!: string;
  @Column({ nullable: true }) paymentRef!: string;
  @Column({ type: 'simple-json' }) repayments!: AdvanceRepayment[];
  @Column({ type: 'float', default: 0 }) recovered!: number;
  @Column({ nullable: true }) createdByName!: string;
  @Column({ nullable: true }) createdById!: string;
  @Column() createdAt!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

/**
 * One stint of an employee on a project. History is kept, never overwritten:
 * a transfer ends the current row and opens a new one pointing back at it.
 */
@Entity('employee_assignments')
export class EmployeeAssignmentEntity {
  @PrimaryColumn() id!: string;
  @Column() employeeId!: string;
  @Column('int') projectId!: number;
  /** Zone / block / area within the project's site, e.g. "Tower A". */
  @Column({ nullable: true }) workArea!: string;
  @Column({ nullable: true }) tradeId!: string;
  @Column({ nullable: true }) designation!: string;
  @Column({ default: 'regular' }) assignmentType!: string; // regular | temporary
  @Column() startDate!: string;
  @Column({ nullable: true }) endDate!: string;
  @Column({ default: 'active' }) status!: string; // active | ended
  @Column({ nullable: true }) endReason!: string; // transfer | completed | demobilized
  @Column({ nullable: true }) transferredFromId!: string;
  @Column({ nullable: true }) workforceRequestId!: string;
  @Column({ nullable: true }) requestLineId!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ nullable: true }) createdByName!: string;
  @Column({ nullable: true }) endedByName!: string;
  @Column() createdAt!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

export interface WorkforceRequestLine { id: string; tradeId: string; designation?: string; quantity: number }

/** A project's ask for labour -- "25 masons, 10 electricians by the 1st" -- filled by deploying workers against it. */
@Entity('workforce_requests')
export class WorkforceRequestEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column({ nullable: true }) workArea!: string;
  @Column() requiredDate!: string;
  @Column({ type: 'int', nullable: true }) durationDays!: number;
  @Column({ type: 'simple-json' }) lines!: WorkforceRequestLine[];
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ default: 'draft' }) status!: string; // draft | submitted | approved | rejected | fulfilled | cancelled
  @Column({ nullable: true }) requestedById!: string;
  @Column({ nullable: true }) requestedByName!: string;
  @Column({ nullable: true }) submittedAt!: string;
  @Column({ nullable: true }) decidedByName!: string;
  @Column({ nullable: true }) decidedAt!: string;
  @Column({ ...TEXT, nullable: true }) decisionNote!: string;
  @Column() createdAt!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

/** A subcontractor / labour-supply company. Its workers are EmployeeEntity rows carrying its id. */
@Entity('contractors')
export class ContractorEntity {
  @PrimaryColumn() id!: string;
  @Column() companyName!: string;
  /** The People-directory entry this came from, when it was created from one. */
  @Column({ type: 'int', nullable: true }) personId!: number;
  @Column({ nullable: true }) contactPerson!: string;
  @Column({ nullable: true }) phone!: string;
  @Column({ nullable: true }) email!: string;
  @Column({ ...TEXT, nullable: true }) address!: string;
  @Column({ nullable: true }) contractNumber!: string;
  @Column({ nullable: true }) contractStart!: string;
  @Column({ nullable: true }) contractEnd!: string;
  @Column({ ...TEXT, nullable: true }) scopeOfWork!: string;
  @Column({ ...TEXT, nullable: true }) agreedRates!: string;
  @Column({ nullable: true }) insuranceProvider!: string;
  @Column({ nullable: true }) insurancePolicyNumber!: string;
  @Column({ nullable: true }) insuranceExpiry!: string;
  /** Licence classifications (subcontractor trades) the company holds. */
  @Column({ type: 'simple-json', nullable: true }) tradeIds!: string[];
  @Column({ nullable: true }) licenseNumber!: string;
  @Column({ nullable: true }) licenseExpiry!: string;
  @Column({ default: 'active' }) status!: string; // active | suspended | ended
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
  @Column() createdAt!: string;
  @Column({ nullable: true }) updatedAt!: string;
  /** The subcontractor portal login for this company (users.id), once invited. */
  @Column({ nullable: true }) userId!: string;
}

/**
 * One person's week: what they worked on (projects, internal work) and any
 * leave, entered by themselves or HR, reviewed, and once approved the hours
 * that payroll pays for those days.
 */
@Entity('timesheets')
export class TimesheetEntity {
  @PrimaryColumn() id!: string;
  @Column() employeeId!: string;
  /** Monday of the week, yyyy-mm-dd. */
  @Column() weekStart!: string;
  @Column({ default: 'draft' }) status!: string; // draft | submitted | approved | rejected
  @Column({ type: 'float', default: 0 }) totalHours!: number;
  /** The employee's note to the reviewer. */
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ nullable: true }) submittedAt!: string;
  @Column({ nullable: true }) submittedById!: string;
  @Column({ nullable: true }) submittedByName!: string;
  @Column({ nullable: true }) decidedAt!: string;
  @Column({ nullable: true }) decidedById!: string;
  @Column({ nullable: true }) decidedByName!: string;
  @Column({ ...TEXT, nullable: true }) decisionNote!: string;
  @Column() createdAt!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

export interface TimesheetDay { hours: number; note?: string }

/** A row of a timesheet: one project/cost code, one kind of internal work, or one leave type, with hours per day. */
@Entity('timesheet_lines')
export class TimesheetLineEntity {
  @PrimaryColumn() id!: string;
  @Column() timesheetId!: string;
  @Column() employeeId!: string;
  @Column() kind!: string; // project | internal | leave
  @Column({ type: 'int', nullable: true }) projectId!: number;
  @Column({ nullable: true }) csiCodeId!: string;
  /** Internal work: office | estimating | design | meetings | travel | other */
  @Column({ nullable: true }) category!: string;
  @Column({ nullable: true }) leaveTypeId!: string;
  @Column({ ...TEXT, nullable: true }) description!: string;
  /** yyyy-mm-dd -> hours (and an optional note for that day). */
  @Column({ type: 'simple-json' }) days!: Record<string, TimesheetDay>;
  /** Leave requests this row raised on submit. */
  @Column({ type: 'simple-json', nullable: true }) leaveRequestIds!: string[];
  @Column('int') order!: number;
}

/**
 * Trades a subcontractor company is licensed for -- the licence classifications
 * (A general engineering, B general building, C specialty, D limited specialty).
 * Distinct from TradeEntity, which is an individual worker's trade.
 */
@Entity('subcontractor_trades')
export class SubcontractorTradeEntity {
  @PrimaryColumn() id!: string;
  @Column() code!: string;
  @Column() name!: string;
  @Column({ default: 'specialty' }) category!: string; // general_engineering | general_building | specialty | limited_specialty | other
  @Column({ ...TEXT, nullable: true }) description!: string;
  @Column({ default: true }) active!: boolean;
  @Column('int') order!: number;
}

/** Shared, admin-editable list of construction trades -- master data, not hardcoded. */
@Entity('trades')
export class TradeEntity {
  @PrimaryColumn() id!: string;
  @Column() name!: string;
  @Column({ default: true }) active!: boolean;
  @Column('int') order!: number;
}

/**
 * An employee's document, certification/licence, or contract. One table for
 * all three: they share the same shape (a type, dates that can expire, files)
 * and differ only in which of the optional fields they use.
 */
@Entity('employee_records')
export class EmployeeRecordEntity {
  @PrimaryColumn() id!: string;
  @Column() employeeId!: string;
  @Column() kind!: string; // document | certification | contract
  @Column({ nullable: true }) type!: string;
  @Column({ nullable: true }) title!: string;
  /** Certificate / licence / contract number. */
  @Column({ nullable: true }) number!: string;
  @Column({ nullable: true }) issuer!: string;
  /** Issue date, or a contract's start date. */
  @Column({ nullable: true }) issueDate!: string;
  /** Expiry date, or a contract's end date. */
  @Column({ nullable: true }) expiryDate!: string;
  @Column({ type: 'float', nullable: true }) rate!: number;
  @Column({ ...TEXT, nullable: true }) terms!: string;
  @Column({ nullable: true }) verification!: string; // pending | verified | rejected
  @Column({ nullable: true }) status!: string;       // contracts: draft | active | renewed | ended
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
  @Column() createdAt!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

/** The shared, org-wide CSI (construction MasterFormat) code list -- one list, every project uses it. */
@Entity('csi_codes')
export class CsiCodeEntity {
  @PrimaryColumn() id!: string;
  @Column() code!: string;
  @Column() division!: string;
  @Column({ nullable: true }) description!: string;
  @Column({ default: true }) active!: boolean;
  @Column('int') order!: number;
}

/** One day's labor report for one project -- the approval unit, mirroring the old paper DCL. */
@Entity('daily_logs')
export class DailyLogEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column() date!: string; // ISO yyyy-mm-dd
  @Column({ nullable: true }) supervisorId!: string;
  @Column({ nullable: true }) supervisorName!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ default: 'draft' }) status!: string; // draft | submitted | approved | rejected
  @Column({ nullable: true }) submittedAt!: string;
  @Column({ nullable: true }) approvedById!: string;
  @Column({ nullable: true }) approvedByName!: string;
  @Column({ nullable: true }) approvedAt!: string;
  @Column({ ...TEXT, nullable: true }) rejectionNote!: string;
  @Column() createdAt!: string;
}

/** One worker's hours under one CSI code within a daily log -- a worker split across projects the same day is just two of these under two different daily logs. */
@Entity('labor_log_entries')
export class LaborLogEntryEntity {
  @PrimaryColumn() id!: string;
  @Column() dailyLogId!: string;
  @Column() employeeId!: string;
  @Column({ nullable: true }) csiCodeId!: string;
  @Column({ type: 'float', nullable: true }) hours!: number;
  @Column({ ...TEXT, nullable: true }) taskDetail!: string;
  @Column({ nullable: true }) taskStatus!: string; // start | continued | completing
  @Column({ nullable: true }) team!: string; // A | B | C | D
}

/** A PTO / sick / unpaid time-off request against an employee's record. */
@Entity('leave_requests')
export class LeaveRequestEntity {
  @PrimaryColumn() id!: string;
  @Column() employeeId!: string;
  @Column() type!: string; // PTO | Sick | Unpaid | Other
  @Column() startDate!: string;
  @Column() endDate!: string;
  @Column({ type: 'float', nullable: true }) hours!: number;
  @Column({ ...TEXT, nullable: true }) reason!: string;
  @Column({ default: 'pending' }) status!: string; // pending | approved | denied
  @Column({ nullable: true }) requestedBy!: string;
  @Column() requestedAt!: string;
  @Column({ nullable: true }) decidedBy!: string;
  @Column({ nullable: true }) decidedAt!: string;
  @Column({ ...TEXT, nullable: true }) note!: string;
  // --- Leave management ---
  @Column({ nullable: true }) leaveTypeId!: string;
  /** A single half day -- only valid when start and end are the same day. */
  @Column({ nullable: true, default: false }) halfDay!: boolean;
  /** Working days taken: weekends and public holidays in the range don't count. */
  @Column({ type: 'float', nullable: true }) days!: number;
  @Column({ nullable: true }) requestedById!: string;
  @Column({ nullable: true }) decidedById!: string;
}

/** A kind of leave and its rules -- entitlement, pay, carry-forward, encashment -- configurable, not hardcoded. */
@Entity('leave_types')
export class LeaveTypeEntity {
  @PrimaryColumn() id!: string;
  @Column() name!: string;
  @Column({ default: true }) paid!: boolean;
  /** Whether a yearly allowance is tracked. Off = no balance (e.g. unpaid, maternity per event). */
  @Column({ default: true }) trackBalance!: boolean;
  @Column({ type: 'float', default: 0 }) annualDays!: number;
  @Column({ type: 'float', default: 0 }) carryForwardMax!: number;
  @Column({ default: false }) encashable!: boolean;
  @Column({ nullable: true }) color!: string;
  @Column({ default: true }) active!: boolean;
  @Column('int') order!: number;
}

/** A balance movement other than taking leave: carried forward, corrected by hand, or cashed out. */
@Entity('leave_adjustments')
export class LeaveAdjustmentEntity {
  @PrimaryColumn() id!: string;
  @Column() employeeId!: string;
  @Column() leaveTypeId!: string;
  @Column('int') year!: number;
  @Column() kind!: string; // carry_forward | manual | encashment
  /** Signed: + adds to the balance, - takes from it. */
  @Column({ type: 'float' }) days!: number;
  /** Encashment only: what the days are worth, paid in the next payroll run. */
  @Column({ type: 'float', nullable: true }) amount!: number;
  @Column({ nullable: true }) payrollRunId!: string;
  @Column({ ...TEXT, nullable: true }) note!: string;
  @Column({ nullable: true }) createdByName!: string;
  @Column() createdAt!: string;
}

/** Company holidays: non-working days for leave counts, and holiday-rate overtime. */
@Entity('public_holidays')
export class PublicHolidayEntity {
  @PrimaryColumn() id!: string;
  @Column() date!: string;
  @Column() name!: string;
}

@Entity('shift_templates')
export class ShiftTemplateEntity {
  @PrimaryColumn() id!: string;
  @Column() name!: string;
  @Column({ nullable: true }) code!: string;
  @Column() kind!: string; // day | night | twelve_hour | weekend | emergency
  @Column() startTime!: string; // HH:MM
  @Column() endTime!: string;
  /** Paid per day actually worked on this shift -- a shift or night allowance. */
  @Column({ type: 'float', default: 0 }) allowancePerDay!: number;
  @Column({ nullable: true }) color!: string;
  @Column({ default: true }) active!: boolean;
  @Column('int') order!: number;
}

/** Who works which shift from when. Several templates = a rotation, switching every `rotateEveryDays`. */
@Entity('shift_assignments')
export class ShiftAssignmentEntity {
  @PrimaryColumn() id!: string;
  @Column() employeeId!: string;
  @Column({ type: 'simple-json' }) templateIds!: string[];
  @Column({ type: 'int', nullable: true }) rotateEveryDays!: number;
  @Column() startDate!: string;
  @Column({ nullable: true }) endDate!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ nullable: true }) createdByName!: string;
  @Column({ nullable: true }) endedByName!: string;
  @Column() createdAt!: string;
}

@Entity('assets')
export class AssetEntity {
  @PrimaryColumn() id!: string;
  /** Human-facing tag stuck on the item, e.g. AST-0007. */
  @Column() assetTag!: string;
  @Column() name!: string;
  @Column() category!: string; // laptop | mobile | sim | tools | uniform | vehicle | access_card | tablet | other
  @Column({ nullable: true }) serialNumber!: string;
  @Column({ default: 'available' }) status!: string; // available | issued | in_repair | lost | retired
  @Column({ default: 'good' }) condition!: string;   // new | good | fair | poor | damaged
  @Column({ nullable: true }) purchaseDate!: string;
  @Column({ type: 'float', nullable: true }) cost!: number;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column() createdAt!: string;
  @Column({ nullable: true }) updatedAt!: string;
}

/** One hand-over of an asset to an employee, open until returned or reported lost. */
@Entity('asset_issues')
export class AssetIssueEntity {
  @PrimaryColumn() id!: string;
  @Column() assetId!: string;
  @Column() employeeId!: string;
  @Column() issuedAt!: string;
  @Column({ nullable: true }) expectedReturn!: string;
  @Column({ default: 'open' }) status!: string; // open | returned | lost
  @Column({ nullable: true }) returnedAt!: string;
  @Column({ nullable: true }) returnCondition!: string;
  /** Lost/damaged: what the employee owes -- settled at exit. */
  @Column({ type: 'float', nullable: true }) chargeAmount!: number;
  /** When this issue replaced a lost or damaged item. */
  @Column({ nullable: true }) replacesIssueId!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ nullable: true }) issuedByName!: string;
  @Column({ nullable: true }) closedByName!: string;
}

/** Camp > building > floor > room > bed, one table. Beds are what people are allocated to. */
@Entity('accommodation_units')
export class AccommodationUnitEntity {
  @PrimaryColumn() id!: string;
  @Column({ nullable: true }) parentId!: string;
  @Column() level!: string; // camp | building | floor | room | bed
  @Column() name!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ default: true }) active!: boolean;
  @Column() createdAt!: string;
}

@Entity('bed_allocations')
export class BedAllocationEntity {
  @PrimaryColumn() id!: string;
  @Column() bedId!: string;
  @Column() employeeId!: string;
  @Column() checkIn!: string;
  @Column({ nullable: true }) checkOut!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ nullable: true }) byName!: string;
}

@Entity('accommodation_issues')
export class AccommodationIssueEntity {
  @PrimaryColumn() id!: string;
  @Column() unitId!: string;
  @Column() title!: string;
  @Column({ ...TEXT, nullable: true }) description!: string;
  @Column({ nullable: true }) employeeId!: string;
  @Column({ default: 'open' }) status!: string; // open | in_progress | resolved
  @Column({ ...TEXT, nullable: true }) resolution!: string;
  @Column({ nullable: true }) reportedByName!: string;
  @Column() reportedAt!: string;
  @Column({ nullable: true }) resolvedAt!: string;
}

@Entity('transport_routes')
export class TransportRouteEntity {
  @PrimaryColumn() id!: string;
  @Column() name!: string;
  @Column({ nullable: true }) vehicle!: string; // registration / description
  @Column({ type: 'int', default: 0 }) capacity!: number;
  @Column({ nullable: true }) driverEmployeeId!: string;
  @Column({ type: 'int', nullable: true }) projectId!: number;
  @Column({ nullable: true }) departureTime!: string;
  @Column({ nullable: true }) returnTime!: string;
  @Column({ type: 'simple-json', nullable: true }) pickupPoints!: string[];
  @Column({ default: 'active' }) status!: string; // active | suspended
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column() createdAt!: string;
}

@Entity('transport_assignments')
export class TransportAssignmentEntity {
  @PrimaryColumn() id!: string;
  @Column() routeId!: string;
  @Column() employeeId!: string;
  @Column({ nullable: true }) pickupPoint!: string;
  @Column() startDate!: string;
  @Column({ nullable: true }) endDate!: string;
  @Column({ nullable: true }) byName!: string;
}

// ================================================================== project financials
// Money is exact: decimal(18,2) read back as a number; the finance module does all
// arithmetic in integer cents. Percentages are decimal(7,4).

const numberFrom = { to: (v: unknown) => v, from: (v: unknown) => (v == null ? null : Number(v)) };
const MONEY = { type: 'decimal', precision: 18, scale: 2, transformer: numberFrom } as const;
const PCT = { type: 'decimal', precision: 7, scale: 4, transformer: numberFrom } as const;
const RATE = { type: 'decimal', precision: 18, scale: 6, transformer: numberFrom } as const;

/** Who/when on every financial row, plus the version optimistic locking checks. */
abstract class FinanceStamped {
  @Column() createdAt!: string;
  @Column({ nullable: true }) createdBy!: string;
  @Column({ nullable: true }) updatedAt!: string;
  @Column({ nullable: true }) updatedBy!: string;
  @VersionColumn() version!: number;
}

/** A project's contract and billing settings. Everything else about its money is derived from items and transactions. */
@Entity('project_financials')
export class ProjectFinancialEntity extends FinanceStamped {
  @PrimaryColumn('int') projectId!: number;
  @Column({ default: 'USD' }) currency!: string;
  @Column({ ...RATE, default: 1 }) fxRate!: number;
  @Column({ ...MONEY, default: 0 }) originalContractValue!: number;
  @Column({ ...MONEY, nullable: true }) originalBudget!: number | null;
  @Column({ ...PCT, default: 0 }) retentionPct!: number;
  @Column({ ...PCT, default: 0 }) taxPct!: number;
  @Column({ type: 'int', default: 30 }) paymentTermsDays!: number;
  @Column({ default: false }) requireProgressApproval!: boolean;
  @Column({ nullable: true }) billToName!: string;
  @Column({ nullable: true }) billToEmail!: string;
  @Column({ ...TEXT, nullable: true }) billToAddress!: string;
  @Column({ nullable: true }) contractNumber!: string;
  @Column({ nullable: true }) poNumber!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  /** Set when the first invoice is issued: the original contract is then changed only through change orders. */
  @Column({ nullable: true }) contractLockedAt!: string;
  /** Progress of the project as one billable item, used when no phase or task carries a value (lump sum). */
  @Column({ ...PCT, default: 0 }) reportedProgress!: number;
  @Column({ ...PCT, default: 0 }) approvedProgress!: number;
  /** Default markup on reimbursable expenses billed back to the client. */
  @Column({ ...PCT, default: 0 }) reimbursableMarkupPct!: number;
  /** Payroll taxes, benefits and insurance on top of wages, for labor cost: 30 means wages x 1.3. */
  @Column({ ...PCT, default: 0 }) laborBurdenPct!: number;
}

/** Shared by milestone (phase) and task financials. */
abstract class ItemFinancialBase extends FinanceStamped {
  @Column('int') projectId!: number;
  /** Null: this item has no value of its own. */
  @Column({ ...MONEY, nullable: true }) contractValue!: number | null;
  @Column({ ...MONEY, nullable: true }) budgetedCost!: number | null;
  @Column({ ...MONEY, nullable: true }) estimatedCost!: number | null;
  /** fixed | percent_complete | quantity | t_and_m | reimbursable | milestone | manual */
  @Column({ default: 'percent_complete' }) billingMethod!: string;
  @Column({ ...PCT, nullable: true }) retentionPctOverride!: number | null;
  @Column({ ...PCT, nullable: true }) taxPctOverride!: number | null;
  @Column({ nullable: true }) csiCodeId!: string;
  @Column({ nullable: true }) subcontractorTradeId!: string;
  @Column({ ...TEXT, nullable: true }) deliverables!: string;
  @Column({ ...TEXT, nullable: true }) requiredFromUs!: string;
  @Column({ ...TEXT, nullable: true }) requiredFromClient!: string;
  @Column({ ...TEXT, nullable: true }) requiredFromContractor!: string;
  @Column({ ...TEXT, nullable: true }) acceptanceCriteria!: string;
  @Column({ ...TEXT, nullable: true }) billingCondition!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ ...PCT, default: 0 }) reportedProgress!: number;
  @Column({ ...PCT, default: 0 }) approvedProgress!: number;
  @Column({ nullable: true }) progressApprovedBy!: string;
  @Column({ nullable: true }) progressApprovedAt!: string;
}

@Entity('phase_financials')
@Index('IX_phase_financials_project', ['projectId'])
export class PhaseFinancialEntity extends ItemFinancialBase {
  @PrimaryColumn() phaseId!: string;
}

@Entity('task_financials')
@Index('IX_task_financials_project', ['projectId'])
@Index('IX_task_financials_phase', ['phaseId'])
export class TaskFinancialEntity extends ItemFinancialBase {
  @PrimaryColumn() taskId!: string;
  /** The task's phase when its value was set; unphased (ad-hoc) tasks have none. */
  @Column({ nullable: true }) phaseId!: string;
}

/** Every change to reported or approved progress -- the source of "previous progress" and its history. */
@Entity('progress_updates')
@Index('IX_progress_updates_project', ['projectId'])
@Index('IX_progress_updates_target', ['targetId'])
export class ProgressUpdateEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column() targetType!: string; // project | phase | task
  @Column() targetId!: string;
  @Column() kind!: string; // reported | approved
  @Column({ ...PCT }) fromPct!: number;
  @Column({ ...PCT }) toPct!: number;
  @Column({ ...TEXT, nullable: true }) reason!: string;
  @Column({ nullable: true }) byName!: string;
  @Column({ nullable: true }) byId!: string;
  @Column() at!: string;
}

/** A client invoice for a project. Totals and lines are snapshots once issued; drafts are recalculated live. */
@Entity('project_invoices')
@Index('IX_project_invoices_project', ['projectId'])
@Index('UQ_project_invoices_number', ['issuedNumber'], { unique: true, where: '[issuedNumber] IS NOT NULL' })
export class ProjectInvoiceEntity extends FinanceStamped {
  @PrimaryColumn() id!: string;
  /** INV-YYYY-0001, given only when the invoice is issued. */
  @Column({ nullable: true }) issuedNumber!: string;
  @Column('int') projectId!: number;
  @Column({ default: 'progress' }) kind!: string; // progress | standard | retention | credit
  @Column({ default: 'draft' }) status!: string; // draft | issued | void
  @Column() invoiceDate!: string;
  @Column({ nullable: true }) dueDate!: string;
  @Column({ nullable: true }) periodStart!: string;
  @Column({ nullable: true }) periodEnd!: string;
  @Column({ default: 'USD' }) currency!: string;
  @Column({ ...RATE, default: 1 }) fxRate!: number;
  @Column({ default: 'USD' }) baseCurrency!: string;
  @Column({ nullable: true }) reference!: string;
  @Column({ nullable: true }) poNumber!: string;
  @Column({ ...TEXT, nullable: true }) description!: string;
  @Column({ nullable: true }) billToName!: string;
  @Column({ nullable: true }) billToEmail!: string;
  @Column({ ...TEXT, nullable: true }) billToAddress!: string;
  @Column({ ...PCT, default: 0 }) retentionPct!: number;
  @Column({ ...PCT, default: 0 }) taxPct!: number;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
  // Snapshotted at issue.
  @Column({ ...MONEY, nullable: true }) contractWork!: number | null;
  @Column({ ...MONEY, nullable: true }) retentionAmount!: number | null;
  @Column({ ...MONEY, nullable: true }) adjustmentTotal!: number | null;
  @Column({ ...MONEY, nullable: true }) taxAmount!: number | null;
  @Column({ ...MONEY, nullable: true }) total!: number | null;
  @Column({ nullable: true }) issuedAt!: string;
  @Column({ nullable: true }) issuedById!: string;
  @Column({ nullable: true }) issuedByName!: string;
  @Column({ nullable: true }) voidedAt!: string;
  @Column({ nullable: true }) voidedById!: string;
  @Column({ nullable: true }) voidedByName!: string;
  @Column({ ...TEXT, nullable: true }) voidReason!: string;
  // --- Phase 2 ---
  /** Credit notes: the invoice being credited, and whether it's a credit or a bad-debt write-off. */
  @Column({ nullable: true }) creditForInvoiceId!: string;
  @Column({ nullable: true }) creditType!: string; // credit | write_off
  @Column({ ...TEXT, nullable: true }) creditReason!: string;
  /** A draft sent for approval by someone who can prepare but not issue invoices. */
  @Column({ nullable: true }) approvalRequestedAt!: string;
  @Column({ nullable: true }) approvalRequestedBy!: string;
}

/** One line of an invoice. Everything that explains its amount is copied onto it when the invoice is issued. */
@Entity('project_invoice_lines')
@Index('IX_invoice_lines_invoice', ['invoiceId'])
@Index('IX_invoice_lines_project', ['projectId'])
@Index('IX_invoice_lines_phase', ['phaseId'])
@Index('IX_invoice_lines_task', ['taskId'])
export class ProjectInvoiceLineEntity {
  @PrimaryColumn() id!: string;
  @Column() invoiceId!: string;
  @Column('int') projectId!: number;
  @Column() kind!: string; // progress | manual | adjustment | reimbursable | retention_release
  /** progress lines: project (lump sum) | phase | task */
  @Column({ nullable: true }) targetType!: string;
  @Column({ nullable: true }) phaseId!: string;
  @Column({ nullable: true }) taskId!: string;
  @Column('int') lineOrder!: number;
  @Column({ ...TEXT }) description!: string;
  @Column({ nullable: true }) billingMethod!: string;
  @Column({ ...MONEY, nullable: true }) contractValue!: number | null;
  @Column({ ...PCT, nullable: true }) prevProgressPct!: number | null;
  @Column({ ...PCT, nullable: true }) currentProgressPct!: number | null;
  @Column({ ...MONEY, nullable: true }) prevBilled!: number | null;
  /** The contract-work claim (pre-tax, before retention). Adjustments may be negative. */
  @Column({ ...MONEY }) amount!: number;
  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true, transformer: numberFrom }) quantity!: number | null;
  @Column({ nullable: true }) unit!: string;
  @Column({ ...MONEY, nullable: true }) rate!: number | null;
  @Column({ default: true }) retentionApplies!: boolean;
  @Column({ ...PCT, default: 0 }) retentionPct!: number;
  @Column({ ...MONEY, default: 0 }) retentionAmount!: number;
  @Column({ default: false }) taxable!: boolean;
  @Column({ ...PCT, default: 0 }) taxPct!: number;
  @Column({ ...MONEY, default: 0 }) taxAmount!: number;
  // --- Phase 2 ---
  /** reimbursable lines: the expense billed. */
  @Column({ nullable: true }) reimbursableId!: string;
  /** retention_release lines: the approved release billed. */
  @Column({ nullable: true }) retentionReleaseId!: string;
  /** credit note lines: the original line being credited. */
  @Column({ nullable: true }) creditsLineId!: string;
}

/** Numbering: one row per sequence and year, read under an update lock while an invoice is issued. */
@Entity('finance_sequences')
export class FinanceSequenceEntity {
  @PrimaryColumn() id!: string; // e.g. INV-2026
  @Column('int') next!: number;
}

/** Money received against an invoice. Corrected by voiding, never deleted. */
@Entity('project_payments')
@Index('IX_project_payments_invoice', ['invoiceId'])
@Index('IX_project_payments_project', ['projectId'])
export class ProjectPaymentEntity extends FinanceStamped {
  @PrimaryColumn() id!: string;
  @Column() invoiceId!: string;
  @Column('int') projectId!: number;
  @Column() date!: string;
  @Column({ ...MONEY }) amount!: number;
  @Column({ default: 'USD' }) currency!: string;
  @Column({ ...RATE, default: 1 }) fxRate!: number;
  @Column({ default: 'ach' }) method!: string; // ach | check | wire | card | cash | other
  @Column({ nullable: true }) bankRef!: string;
  @Column({ nullable: true }) txnRef!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
  @Column({ nullable: true }) voidedAt!: string;
  @Column({ nullable: true }) voidedByName!: string;
  @Column({ ...TEXT, nullable: true }) voidReason!: string;
}

/** The audit trail: every financial change, with before and after. */
@Entity('finance_activity')
@Index('IX_finance_activity_project', ['projectId'])
export class FinanceActivityEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column() entityType!: string;
  @Column() entityId!: string;
  @Column() action!: string;
  @Column({ type: 'simple-json', nullable: true }) changes!: Record<string, { from: unknown; to: unknown }> | null;
  @Column({ ...TEXT, nullable: true }) reason!: string;
  @Column({ nullable: true }) byName!: string;
  @Column({ nullable: true }) byId!: string;
  @Column() at!: string;
}

// ------------------------------------------------------------------ financials, phase 2

/**
 * A change to the contract: priced, reviewed internally, sent to the client and
 * approved (or not). Only approved change orders move the revised contract and
 * the values of the items they touch.
 */
@Entity('change_orders')
@Index('IX_change_orders_project', ['projectId'])
@Index('UQ_change_orders_number', ['projectId', 'number'], { unique: true })
export class ChangeOrderEntity extends FinanceStamped {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  /** CO-001, per project, given when the change order is created. */
  @Column() number!: string;
  @Column() title!: string;
  @Column({ ...TEXT, nullable: true }) description!: string;
  /** client_request | design_change | unforeseen | scope_addition | scope_reduction | allowance | code_requirement | other */
  @Column({ default: 'client_request' }) reason!: string;
  @Column({ nullable: true }) requestedBy!: string;
  /** draft | internal_review | submitted | approved | rejected | cancelled */
  @Column({ default: 'draft' }) status!: string;
  @Column({ type: 'int', default: 0 }) scheduleImpactDays!: number;
  /** Frozen at approval; open change orders are summed live from their items. */
  @Column({ ...MONEY, nullable: true }) amount!: number | null;
  @Column({ nullable: true }) dateRequested!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
  @Column({ nullable: true }) submittedAt!: string;
  @Column({ nullable: true }) submittedBy!: string;
  @Column({ nullable: true }) internalApprovedAt!: string;
  @Column({ nullable: true }) internalApprovedBy!: string;
  /** Who signed for the client, when, and their reference. */
  @Column({ nullable: true }) clientSigner!: string;
  @Column({ nullable: true }) clientApprovedDate!: string;
  @Column({ nullable: true }) clientReference!: string;
  @Column({ nullable: true }) approvedAt!: string;
  @Column({ nullable: true }) approvedBy!: string;
  @Column({ nullable: true }) rejectedAt!: string;
  @Column({ nullable: true }) rejectedBy!: string;
  @Column({ nullable: true }) cancelledAt!: string;
  @Column({ nullable: true }) cancelledBy!: string;
  @Column({ ...TEXT, nullable: true }) closedReason!: string;
}

/** One priced change inside a change order, and the schedule-of-values item it changes. */
@Entity('change_order_items')
@Index('IX_change_order_items_co', ['changeOrderId'])
@Index('IX_change_order_items_project', ['projectId'])
export class ChangeOrderItemEntity {
  @PrimaryColumn() id!: string;
  @Column() changeOrderId!: string;
  @Column('int') projectId!: number;
  @Column('int') lineOrder!: number;
  @Column({ ...TEXT }) description!: string;
  /** phase | task | new_phase | new_task | none (raises the contract; allocated to items later) */
  @Column({ default: 'none' }) targetType!: string;
  /** The existing -- or, once approved, the newly created -- phase / task. new_task keeps its milestone in phaseId. */
  @Column({ nullable: true }) phaseId!: string;
  @Column({ nullable: true }) taskId!: string;
  /** Name of the milestone / task created on approval. */
  @Column({ nullable: true }) newName!: string;
  /** Positive adds to the contract, negative deducts. */
  @Column({ ...MONEY }) amount!: number;
  @Column({ ...MONEY, nullable: true }) cost!: number | null;
  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true, transformer: numberFrom }) quantity!: number | null;
  @Column({ nullable: true }) unit!: string;
  @Column({ ...MONEY, nullable: true }) rate!: number | null;
  @Column({ nullable: true }) csiCodeId!: string;
  @Column() createdAt!: string;
}

/** Costs incurred for the client and billed back to them, usually with a markup. Outside the contract. */
@Entity('reimbursables')
@Index('IX_reimbursables_project', ['projectId'])
@Index('UQ_reimbursables_number', ['projectId', 'number'], { unique: true })
export class ReimbursableEntity extends FinanceStamped {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column() number!: string; // RE-001
  @Column() date!: string;
  @Column({ ...TEXT }) description!: string;
  /** travel | printing | permits_fees | materials | consultants | shipping | equipment | other */
  @Column({ default: 'other' }) category!: string;
  @Column({ nullable: true }) vendor!: string;
  @Column({ ...MONEY }) cost!: number;
  @Column({ ...PCT, default: 0 }) markupPct!: number;
  /** False: tracked as a project cost only, never billed. */
  @Column({ default: true }) billable!: boolean;
  @Column({ default: false }) taxable!: boolean;
  @Column({ nullable: true }) phaseId!: string;
  @Column({ nullable: true }) csiCodeId!: string;
  /** submitted | approved | rejected | billed */
  @Column({ default: 'submitted' }) status!: string;
  @Column({ nullable: true }) submittedBy!: string;
  @Column({ nullable: true }) approvedAt!: string;
  @Column({ nullable: true }) approvedBy!: string;
  @Column({ nullable: true }) rejectedAt!: string;
  @Column({ nullable: true }) rejectedBy!: string;
  @Column({ ...TEXT, nullable: true }) rejectedReason!: string;
  /** The issued invoice it was billed on. */
  @Column({ nullable: true }) invoiceId!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
}

/** A request to pay back retention held -- for the whole project, a milestone or a task. */
@Entity('retention_releases')
@Index('IX_retention_releases_project', ['projectId'])
@Index('UQ_retention_releases_number', ['projectId', 'number'], { unique: true })
export class RetentionReleaseEntity extends FinanceStamped {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column() number!: string; // RR-001
  /** project | phase | task */
  @Column({ default: 'project' }) scope!: string;
  @Column({ nullable: true }) targetId!: string;
  @Column({ ...MONEY }) amount!: number;
  /** substantial_completion | final_completion | milestone_accepted | partial | other */
  @Column({ default: 'substantial_completion' }) reason!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  /** requested | approved | rejected | billed | cancelled */
  @Column({ default: 'requested' }) status!: string;
  @Column({ nullable: true }) requestedBy!: string;
  @Column({ nullable: true }) approvedAt!: string;
  @Column({ nullable: true }) approvedBy!: string;
  @Column({ nullable: true }) rejectedAt!: string;
  @Column({ nullable: true }) rejectedBy!: string;
  @Column({ ...TEXT, nullable: true }) closedReason!: string;
  /** The invoice (draft or issued) billing the release. */
  @Column({ nullable: true }) invoiceId!: string;
}

/** Every decision on a financial record: who approved, rejected, submitted or signed, when and why. */
@Entity('financial_approvals')
@Index('IX_financial_approvals_project', ['projectId'])
@Index('IX_financial_approvals_entity', ['entityId'])
export class FinancialApprovalEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  /** change_order | reimbursable | retention_release | invoice | credit_note | progress */
  @Column() entityType!: string;
  @Column() entityId!: string;
  /** submitted | internal_approved | client_approved | approved | rejected | cancelled | returned | issued | requested */
  @Column() decision!: string;
  @Column({ ...TEXT, nullable: true }) comment!: string;
  /** For client approvals: who signed. */
  @Column({ nullable: true }) signer!: string;
  @Column({ ...MONEY, nullable: true }) amount!: number | null;
  @Column({ nullable: true }) byName!: string;
  @Column({ nullable: true }) byId!: string;
  @Column() at!: string;
}

// ------------------------------------------------------------------ financials, phase 3: job cost

/** The cost budget, line by line: a cost code (and optionally the milestone or task it serves). */
@Entity('cost_budget_lines')
@Index('IX_cost_budget_lines_project', ['projectId'])
export class CostBudgetLineEntity extends FinanceStamped {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  /** Null: not yet assigned to a cost code. */
  @Column({ nullable: true }) csiCodeId!: string;
  @Column({ nullable: true }) phaseId!: string;
  @Column({ nullable: true }) taskId!: string;
  @Column({ ...TEXT, nullable: true }) description!: string;
  @Column({ ...MONEY }) amount!: number;
  @Column({ ...TEXT, nullable: true }) notes!: string;
}

/** A subcontract or purchase order: cost the project is committed to before it's billed. */
@Entity('commitments')
@Index('IX_commitments_project', ['projectId'])
@Index('UQ_commitments_number', ['projectId', 'number'], { unique: true })
export class CommitmentEntity extends FinanceStamped {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  /** SC-001 for subcontracts, PO-001 for purchase orders and service agreements. */
  @Column() number!: string;
  /** subcontract | purchase_order | service */
  @Column({ default: 'subcontract' }) type!: string;
  @Column({ nullable: true }) contractorId!: string;
  @Column() vendorName!: string;
  @Column() title!: string;
  @Column({ ...TEXT, nullable: true }) scope!: string;
  /** draft | approved | closed | void */
  @Column({ default: 'draft' }) status!: string;
  @Column({ nullable: true }) dateIssued!: string;
  @Column({ nullable: true }) approvedAt!: string;
  @Column({ nullable: true }) approvedBy!: string;
  @Column({ nullable: true }) closedAt!: string;
  @Column({ nullable: true }) closedBy!: string;
  @Column({ ...TEXT, nullable: true }) closedReason!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
  /** Documents the subcontractor can see in their portal (specs, drawings, the signed agreement). Internal attachments stay internal. */
  @Column({ type: 'simple-json', nullable: true }) sharedAttachments!: TaskAttachment[];
}

@Entity('commitment_lines')
@Index('IX_commitment_lines_commitment', ['commitmentId'])
@Index('IX_commitment_lines_project', ['projectId'])
export class CommitmentLineEntity {
  @PrimaryColumn() id!: string;
  @Column() commitmentId!: string;
  @Column('int') projectId!: number;
  @Column('int') lineOrder!: number;
  @Column({ ...TEXT }) description!: string;
  @Column({ nullable: true }) csiCodeId!: string;
  @Column({ nullable: true }) phaseId!: string;
  @Column({ nullable: true }) taskId!: string;
  @Column({ ...MONEY }) amount!: number;
}

/** A cost incurred: a vendor bill, subcontractor invoice, material or equipment charge. Labor and reimbursables are counted from their own records. */
@Entity('cost_entries')
@Index('IX_cost_entries_project', ['projectId'])
@Index('IX_cost_entries_commitment', ['commitmentId'])
export class CostEntryEntity extends FinanceStamped {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column() date!: string;
  @Column({ nullable: true }) dueDate!: string;
  /** vendor_bill | subcontract_invoice | material | equipment | other */
  @Column({ default: 'vendor_bill' }) type!: string;
  @Column({ nullable: true }) contractorId!: string;
  @Column({ nullable: true }) vendorName!: string;
  /** The vendor's bill / invoice number. */
  @Column({ nullable: true }) reference!: string;
  @Column({ nullable: true }) commitmentId!: string;
  @Column({ nullable: true }) csiCodeId!: string;
  @Column({ nullable: true }) phaseId!: string;
  @Column({ nullable: true }) taskId!: string;
  @Column({ ...TEXT }) description!: string;
  @Column({ ...MONEY }) amount!: number;
  /** recorded | approved | paid | void */
  @Column({ default: 'recorded' }) status!: string;
  @Column({ nullable: true }) approvedBy!: string;
  @Column({ nullable: true }) approvedAt!: string;
  @Column({ nullable: true }) paidDate!: string;
  @Column({ nullable: true }) paymentRef!: string;
  @Column({ ...TEXT, nullable: true }) voidReason!: string;
  @Column({ ...TEXT, nullable: true }) notes!: string;
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[];
  /** 'portal' when the subcontractor submitted it themselves. */
  @Column({ nullable: true }) source!: string;
  /** Lines submitted together as one invoice share a batch. */
  @Column({ nullable: true }) batchId!: string;
  @Column({ nullable: true }) submittedByUserId!: string;
}

/** A cost code's forecast at completion, when the team knows better than budget-or-spend. */
@Entity('cost_forecasts')
@Index('IX_cost_forecasts_project', ['projectId'])
export class CostForecastEntity extends FinanceStamped {
  /** `${projectId}:${csiCodeId || 'none'}` */
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column({ nullable: true }) csiCodeId!: string;
  @Column({ ...MONEY }) eac!: number;
  @Column({ ...TEXT, nullable: true }) note!: string;
}

/** A drawing / file in the File Room an RFI points at. */
export interface RfiDrawingRef { fileId: string; name: string }
/** Someone an RFI goes to or is copied to -- a People contact, a staff member, or just a name and email. */
export interface RfiContact { name: string; email?: string; company?: string; personId?: number }
export interface RfiEvent { at: string; by: string; action: string; note?: string }

/**
 * A Request for Information: a question to the architect / engineer / owner
 * that needs a written answer before work can go on. Numbered per project
 * (RFI-001), sent by email with a PDF copy, answered, then closed; cost or
 * schedule impact can turn into a change order.
 */
@Entity('rfis')
@Index('UQ_rfis_number', ['projectId', 'number'], { unique: true })
@Index('IX_rfis_project', ['projectId'])
export class RfiEntity {
  @PrimaryColumn() id!: string;
  @Column('int') projectId!: number;
  @Column() number!: string;
  @Column() subject!: string;
  /** draft | open | answered | closed | void */
  @Column() status!: string;
  @Column({ nullable: true }) priority!: string;
  @Column({ ...TEXT, nullable: true }) question!: string;
  /** The contractor's proposed answer, if any -- speeds up the reply. */
  @Column({ ...TEXT, nullable: true }) suggestion!: string;
  @Column({ nullable: true }) discipline!: string;
  @Column({ nullable: true }) specSection!: string;
  /** Sheet / detail as written on the drawings, e.g. "A-201, detail 5". */
  @Column({ nullable: true }) drawingRef!: string;
  @Column({ type: 'simple-json', nullable: true }) drawings!: RfiDrawingRef[] | null;
  @Column({ type: 'simple-json', nullable: true }) to!: RfiContact | null;
  @Column({ type: 'simple-json', nullable: true }) cc!: RfiContact[] | null;
  /** Staff member who owns it internally (chases the answer, closes it). */
  @Column({ nullable: true }) ownerId!: string;
  @Column({ nullable: true }) ownerName!: string;
  @Column({ nullable: true }) dateSent!: string;
  @Column({ nullable: true }) dateDue!: string;
  @Column({ nullable: true }) dateAnswered!: string;
  @Column({ nullable: true }) dateClosed!: string;
  @Column({ ...TEXT, nullable: true }) answer!: string;
  @Column({ nullable: true }) answeredBy!: string;
  /** none | yes | tbd */
  @Column({ nullable: true }) costImpact!: string;
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true, transformer: { to: (v: any) => v, from: (v: any) => (v == null ? null : Number(v)) } }) costAmount!: number | null;
  @Column({ nullable: true }) scheduleImpact!: string;
  @Column('int', { nullable: true }) scheduleDays!: number | null;
  @Column({ nullable: true }) changeOrderId!: string;
  @Column({ nullable: true }) changeOrderNumber!: string;
  /** The task it was converted from, if any. */
  @Column({ nullable: true }) sourceTaskId!: string;
  @Column({ nullable: true }) sourceTaskType!: string;
  @Column({ type: 'simple-json', nullable: true }) attachments!: TaskAttachment[] | null;
  @Column({ type: 'simple-json', nullable: true }) history!: RfiEvent[] | null;
  @Column({ ...TEXT, nullable: true }) voidReason!: string;
  @Column() createdAt!: string;
  @Column({ nullable: true }) createdBy!: string;
  @Column({ nullable: true }) updatedAt!: string;
  @Column({ nullable: true }) updatedBy!: string;
}
