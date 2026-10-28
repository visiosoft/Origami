import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import type { Collaborator } from '../../database/task.types';

// Matches the Request-Log task record (frontend data/tasks.ts Task).
export class CreateTaskDto {
  @IsString() @IsOptional() id?: string;
  @IsString() @IsOptional() tab?: string; // internal | owner | subcontractor
  @IsString() @IsOptional() meetingType?: string;
  @IsString() @IsOptional() meetingDate?: string;
  @IsString() @IsOptional() assignedTo?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() originator?: string;
  @IsString() @IsOptional() topicType?: string;
  /** The meeting it was raised in. */
  @IsString() @IsOptional() meetingId?: string;
  /** The task's name, kept apart from the description. */
  @IsString() @IsOptional() subject?: string;
  @IsString() @IsOptional() priority?: string;
  @IsString() @IsOptional() leadId?: string;
  @IsString() @IsOptional() holdReason?: string;
  @IsString() @IsOptional() completionNote?: string;
  @IsBoolean() @IsOptional() deferNotify?: boolean;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() dueTime?: string;
  @IsString() @IsOptional() linkedFile?: string;
  @IsString() @IsOptional() project?: string;
  @IsString() @IsOptional() resolution?: string;
  @IsString() @IsOptional() dateClosed?: string;
  @IsArray() @IsOptional() labels?: string[];
  /** Cleaned by normalizeCollaborators; without this line the picker's choice was stripped. */
  @IsArray() @IsOptional() collaborators?: Collaborator[];
  @IsArray() @IsOptional() checklist?: { id: string; item: string; done: boolean }[];
  /** FOR RECORD links: the tasks and change orders (ids) this entry drove or is attached to. */
  @IsArray() @IsOptional() @IsString({ each: true }) linkedTaskIds?: string[];
  @IsArray() @IsOptional() @IsString({ each: true }) changeOrderIds?: string[];
}
