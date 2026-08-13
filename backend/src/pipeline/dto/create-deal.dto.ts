import { IsString, IsNumber, IsOptional, IsArray, Allow } from 'class-validator';

export class CreateDealDto {
  @IsString() @IsOptional() id?: string;
  @IsString() name: string;
  @IsString() client: string;
  @IsString() value: string;
  @IsString() @IsOptional() stage?: string;
  @IsNumber() @IsOptional() stageIdx?: number;
  @IsString() @IsOptional() assignedRole?: string;
  @IsString() @IsOptional() assignee?: string;
  @IsString() @IsOptional() assigneeInit?: string;
  @IsNumber() @IsOptional() daysInStage?: number;
  @IsString() @IsOptional() nextAction?: string;
  @IsString() @IsOptional() nextDue?: string;
  @IsString() @IsOptional() source?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() email?: string;
  @IsArray() @IsOptional() timeline?: any[];
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() owner?: string;
}
