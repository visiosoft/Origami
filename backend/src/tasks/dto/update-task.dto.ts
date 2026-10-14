import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Every field optional — this is a patch.
 *
 * ValidationPipe runs with `whitelist: true`, so anything NOT declared here is
 * silently dropped from the body. Add new task fields in this file or they will
 * never reach the database.
 */
export class UpdateTaskDto {
  @IsString() @IsOptional() tab?: string;
  @IsString() @IsOptional() meetingType?: string;
  @IsString() @IsOptional() meetingDate?: string;
  @IsString() @IsOptional() assignedTo?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() originator?: string;
  @IsString() @IsOptional() topicType?: string;
  /** The meeting it was raised in. */
  @IsString() @IsOptional() meetingId?: string;
  @IsString() @IsOptional() subject?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() dueTime?: string;
  @IsString() @IsOptional() dateClosed?: string;
  @IsString() @IsOptional() resolution?: string;
  @IsString() @IsOptional() linkedFile?: string;
  @IsString() @IsOptional() project?: string;
  @IsArray() @IsOptional() labels?: string[];
  @IsArray() @IsOptional() checklist?: { id: string; item: string; done: boolean }[];
  /** FOR RECORD links: the tasks and change orders (ids) this entry drove or is attached to. */
  @IsArray() @IsOptional() @IsString({ each: true }) linkedTaskIds?: string[];
  @IsArray() @IsOptional() @IsString({ each: true }) changeOrderIds?: string[];
}

export class AddCommentDto {
  @IsString() text: string;
}

export class AddLinkDto {
  @IsString() @IsOptional() name?: string;
  @IsString() url: string;
}

/** Attach an entry to a Request Log task or a change order. */
export class LinkDto {
  @IsString() @IsIn(['task', 'changeOrder']) kind!: 'task' | 'changeOrder';
  @IsString() targetId!: string;
}

/** A task driven by an entry (all optional: the subject defaults to "Follow up: …"). */
export class LinkedTaskDto {
  @IsString() @IsOptional() @MaxLength(300) subject?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() assignedTo?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @IsOptional() dueDate?: string;
}
