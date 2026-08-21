import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';
import type { ChecklistItem, TaskAttachment, TaskComment } from '../../database/task.types';

/**
 * ValidationPipe runs with `whitelist: true`, so anything NOT declared here is
 * silently stripped from the request body. New task fields must be added in
 * this file or they never reach the database.
 */
export class CreateProjectTaskDto {
  @IsString() @IsOptional() id?: string;
  @IsNumber() projectId: number;
  @IsString() @IsOptional() sectionId?: string;
  @IsString() title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() assignee?: string;
  @IsString() @IsOptional() assigneeId?: string;
  @IsString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() priority?: string;
  @IsString() @IsOptional() status?: string;
  @IsNumber() @IsOptional() order?: number;
  @IsBoolean() @IsOptional() completed?: boolean;
  @IsString() @IsOptional() parentId?: string | null;
  @IsArray() @IsOptional() labels?: string[];
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
}

/** Body for the batch card-reorder endpoint. */
export class ReorderDto {
  @IsString() sectionId: string;
  @IsArray() ids: string[];
}
