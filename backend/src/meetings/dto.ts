import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export const MEETING_TYPES = ['Internal', 'Client', 'Consultant', 'Subcontractor', 'Site'];
export const MEETING_STATUSES = ['scheduled', 'held', 'cancelled'];

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
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => AttendeeDto) attendees?: AttendeeDto[];
  @IsString() @IsOptional() agenda?: string;
  @IsString() @IsOptional() minutes?: string;
  @IsString() @IsOptional() @IsIn(MEETING_STATUSES) status?: string;
  @IsArray() @IsOptional() @IsString({ each: true }) rfiIds?: string[];
}

/** One action raised in a meeting: becomes a Request Log entry linked to it. */
export class MeetingActionDto {
  @IsString() @IsIn(['Task', 'FYI', 'Observation']) topicType!: string;
  @IsString() @MaxLength(300) subject!: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() assignedTo?: string;
  @IsString() @IsOptional() assignedToId?: string;
  @IsString() @IsOptional() dueDate?: string;
}
