import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsObject, MaxLength } from 'class-validator';

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
  // --- Daily Report ---
  /** Edit this exact report (a version); without it the day's latest report is used. */
  @IsString() @IsOptional() id?: string;
  /** Start an updated report for a day that already has one. */
  @IsBoolean() @IsOptional() newVersion?: boolean;
  @IsObject() @IsOptional() sections?: Record<string, any> | null;
  @IsString() @IsOptional() @MaxLength(200) onBehalfOf?: string;
  @IsString() @IsOptional() @MaxLength(200) certifiedName?: string;
  @IsString() @IsOptional() @MaxLength(400000) signatureDataUrl?: string;
  @IsObject() @IsOptional() dupBaseline?: Record<string, any> | null;
  @IsString() @IsOptional() dupFromDate?: string;
}

/** A named Daily Report starting point. */
export class SaveDailyReportTemplateDto {
  @IsString() @MaxLength(120) name: string;
  @IsObject() @IsOptional() sections?: Record<string, any> | null;
  @IsArray() @IsOptional() entries?: Record<string, any>[];
}

export class RejectDailyLogDto {
  @IsString() @IsOptional() note?: string;
}
