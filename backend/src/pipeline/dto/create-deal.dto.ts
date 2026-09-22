import { IsString, IsNumber, IsOptional, IsArray, Allow } from 'class-validator';

export class CreateDealDto {
  @IsString() @IsOptional() id?: string;
  // name/client no longer persist onto the deal -- the lead is the sole
  // source of truth for them (see PipelineService.overlayLead). Kept
  // optional here rather than removed outright since older frontend
  // payloads still send them; they're simply ignored on save.
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() client?: string;
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
