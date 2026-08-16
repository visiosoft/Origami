import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateWorkflowDto {
  @IsString() @IsOptional() id?: string;
  @IsNumber() @IsOptional() projectId?: number | null;
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() owner?: string;
  @IsNumber() @IsOptional() estimatedDays?: number | null;
  @IsString() @IsOptional() plannedStart?: string;
  @IsString() @IsOptional() plannedEnd?: string;
  @IsString() @IsOptional() completedAt?: string;
}
