import { MaxLength, IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsObject } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import type { ChecklistItem, Collaborator, TaskAttachment, TaskComment } from '../../database/task.types';

/**
 * ValidationPipe runs with `whitelist: true`, so anything NOT declared here is
 * silently stripped from the request body. New task fields must be added in
 * this file or they never reach the database.
 */
export class CreateProjectTaskDto {
  @IsString() @IsOptional() id?: string;
  // Absent/null = a General Tasks board task, not tied to any client project.
  @IsNumber() @IsOptional() projectId?: number | null;
  @IsString() @IsOptional() sectionId?: string;
  @IsString() title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() assignee?: string;
  @IsString() @IsOptional() assigneeId?: string;
  @IsString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() priority?: string;
  @IsString() @IsOptional() leadId?: string;
  @IsString() @IsOptional() holdReason?: string;
  @IsString() @IsOptional() completionNote?: string;
  @IsString() @IsOptional() requestedById?: string;
  @IsString() @IsOptional() requestedBy?: string;
  @IsBoolean() @IsOptional() deferNotify?: boolean;
  @IsBoolean() @IsOptional() close?: boolean;
  /** Nov 17: the epic it belongs to (null to take it out). */
  @IsString() @IsOptional() @MaxLength(40) epicId?: string | null;
  @IsString() @IsOptional() status?: string;
  @IsNumber() @IsOptional() order?: number;
  @IsBoolean() @IsOptional() completed?: boolean;
  @IsString() @IsOptional() parentId?: string | null;
  @IsArray() @IsOptional() labels?: string[];
  @IsArray() @IsOptional() @IsString({ each: true }) tags?: string[];
  @IsArray() @IsOptional() collaborators?: Collaborator[];
  @IsArray() @IsOptional() checklist?: ChecklistItem[];
  @IsArray() @IsOptional() attachments?: TaskAttachment[];
  @IsArray() @IsOptional() comments?: TaskComment[];
  // --- Phase Board ---
  @IsString() @IsOptional() phaseId?: string | null;
  @IsString() @IsOptional() team?: string;
  @IsBoolean() @IsOptional() auto?: boolean;
  @IsString() @IsOptional() autoLabel?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() endDate?: string;
  @IsNumber() @IsOptional() durationDays?: number;
  @IsArray() @IsOptional() dependsOn?: string[];
  /** Nov 27: repeats like a calendar invite ({ every: 'day' | 'weekdays' | 'week' | 'month', days?, until? }); null = doesn't. */
  @IsOptional() @IsObject() repeat?: Record<string, unknown> | null;
}

/**
 * A patch: every field optional. A real class (not `Partial<>`, which erases to
 * Object at runtime) so the ValidationPipe checks and whitelists it.
 */
export class UpdateProjectTaskDto extends PartialType(CreateProjectTaskDto) {
  /** Nov 17: why an overdue task's due date is moving (required then). */
  @IsString() @IsOptional() @MaxLength(600) dueReason?: string;
}

/** Body for the batch card-reorder endpoint. */
export class ReorderDto {
  @IsString() sectionId: string;
  @IsArray() ids: string[];
}
