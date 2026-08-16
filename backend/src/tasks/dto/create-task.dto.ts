import { IsString, IsOptional } from 'class-validator';

// Matches the Request-Log task record (frontend data/tasks.ts Task).
export class CreateTaskDto {
  @IsString() @IsOptional() id?: string;
  @IsString() @IsOptional() tab?: string; // internal | owner | subcontractor
  @IsString() @IsOptional() meetingType?: string;
  @IsString() @IsOptional() meetingDate?: string;
  @IsString() @IsOptional() assignedTo?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() originator?: string;
  @IsString() @IsOptional() topicType?: string;
  @IsString() description: string;
  @IsString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() linkedFile?: string;
  @IsString() @IsOptional() project?: string;
}
