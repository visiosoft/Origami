import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateWorkflowItemDto {
  @IsString() @IsOptional() id?: string;
  @IsString() workflowId: string;
  @IsString() title: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
  @IsNumber() @IsOptional() order?: number;
  @IsNumber() @IsOptional() estimatedDays?: number | null;
  @IsString() @IsOptional() plannedStart?: string;
  @IsString() @IsOptional() plannedEnd?: string;
  @IsString() @IsOptional() completedAt?: string;
}
