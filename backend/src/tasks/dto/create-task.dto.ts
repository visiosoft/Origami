import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum TaskStatus {
  Open = 'Open',
  InProgress = 'In Progress',
  Closed = 'Closed',
}

export enum TaskCategory {
  Internal = 'internal',
  Owner = 'owner',
  Subcontractor = 'subcontractor',
}

export class CreateTaskDto {
  @IsString()
  description: string;

  @IsString()
  assignedTo: string;

  @IsString()
  originator: string;

  @IsString()
  @IsOptional()
  meetingType?: string;

  @IsString()
  @IsOptional()
  meetingDate?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskCategory)
  category: TaskCategory;

  @IsString()
  project: string;

  @IsString()
  @IsOptional()
  topicType?: string;
}
