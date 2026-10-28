import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { MEETING_LOCATION_TYPES, MEETING_STATUSES } from './meeting-status';

export const MEETING_TYPES = ['Internal', 'Client', 'Consultant', 'Subcontractor', 'Site'];
export { MEETING_LOCATION_TYPES, MEETING_STATUSES };
/** What can be raised from a meeting as a Request Log entry: a task, or a FOR RECORD item. */
export const MEETING_ACTION_TOPICS = ['Task', 'FYI', 'Observation', 'Decision'];

export class AttendeeDto {
  @IsString() @IsOptional() id?: string;
  @IsString() @MaxLength(200) name!: string;
  @IsString() @IsOptional() email?: string;
}

export class MeetingDto {
  @IsString() @IsOptional() @MaxLength(300) title?: string;
  @IsString() @IsOptional() @IsIn(MEETING_TYPES) type?: string;
  @IsInt() @IsOptional() projectId?: number | null;
  @IsString() @IsOptional() project?: string;
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() time?: string;
  @IsString() @IsOptional() location?: string;
  @IsString() @IsOptional() @IsIn([...MEETING_LOCATION_TYPES]) locationType?: string;
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => AttendeeDto) attendees?: AttendeeDto[];
  @IsString() @IsOptional() agenda?: string;
  @IsString() @IsOptional() minutes?: string;
  /** Older clients may still send "held"; it is stored as "occurred". */
  @IsString() @IsOptional() @IsIn([...MEETING_STATUSES, 'held']) status?: string;
  @IsArray() @IsOptional() @IsString({ each: true }) rfiIds?: string[];
  @IsArray() @IsOptional() @IsString({ each: true }) changeOrderIds?: string[];
  @IsString() @IsOptional() @MaxLength(1000) recordingUrl?: string;
  @IsString() @IsOptional() @MaxLength(1000) transcriptUrl?: string;
  @IsString() @IsOptional() transcript?: string;
}

/** One action raised in a meeting: becomes a Request Log entry linked to it. */
export class MeetingActionDto {
  @IsString() @IsIn(MEETING_ACTION_TOPICS) topicType!: string;
  @IsString() @MaxLength(300) subject!: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() assignedTo?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @IsOptional() dueDate?: string;
  /** Urgent / High / Medium / Low; a next step with no date comes in High until changed (Oct 26 review notes). */
  @IsString() @IsOptional() priority?: string;
}
