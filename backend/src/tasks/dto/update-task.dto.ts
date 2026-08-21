import { IsArray, IsOptional, IsString } from 'class-validator';

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
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() dateClosed?: string;
  @IsString() @IsOptional() resolution?: string;
  @IsString() @IsOptional() linkedFile?: string;
  @IsString() @IsOptional() project?: string;
  @IsArray() @IsOptional() labels?: string[];
  @IsArray() @IsOptional() checklist?: { id: string; item: string; done: boolean }[];
}

export class AddCommentDto {
  @IsString() text: string;
}

export class AddLinkDto {
  @IsString() @IsOptional() name?: string;
  @IsString() url: string;
}
