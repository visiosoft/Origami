import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class LaborLogEntryDto {
  @IsString() @IsOptional() id?: string;
  @IsString() employeeId: string;
  @IsString() @IsOptional() csiCodeId?: string;
  @IsNumber() @IsOptional() hours?: number;
  @IsString() @IsOptional() taskDetail?: string;
  @IsString() @IsOptional() taskStatus?: string;
  @IsString() @IsOptional() team?: string;
}

/** Upserts a project+date's daily log: notes plus a full replace of its entry rows. */
export class SaveDailyLogDto {
  @IsNumber() projectId: number;
  @IsString() date: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray() @IsOptional() entries?: LaborLogEntryDto[];
}

export class RejectDailyLogDto {
  @IsString() @IsOptional() note?: string;
}
