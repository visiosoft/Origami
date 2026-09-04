import { IsString, IsOptional, IsArray, IsNumber, IsObject, IsBoolean } from 'class-validator';

// Matches the People directory record (frontend data/people.ts Person).
export class CreatePersonDto {
  @IsNumber() @IsOptional() id?: number;
  @IsString() name: string;
  // --- Profile ---
  @IsString() @IsOptional() firstName?: string;
  @IsString() @IsOptional() lastName?: string;
  @IsString() @IsOptional() goByName?: string;
  @IsString() @IsOptional() pronouns?: string;
  @IsString() @IsOptional() gender?: string;
  @IsArray() @IsOptional() categories?: string[];
  @IsObject() @IsOptional() addresses?: Record<string, unknown>;
  @IsObject() @IsOptional() contactInfo?: Record<string, unknown>;
  @IsArray() @IsOptional() licenses?: unknown[];
  @IsObject() @IsOptional() insurance?: Record<string, unknown>;
  @IsBoolean() @IsOptional() notLicensedDesigner?: boolean;
  @IsString() @IsOptional() role?: string;
  @IsString() @IsOptional() company?: string;
  @IsString() @IsOptional() contact?: string;
  @IsString() @IsOptional() kind?: string;   // Staff | Client | Consultant | Sub | Authority | Vendor
  @IsString() @IsOptional() tier?: string;   // Internal | Client | Consultant
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() email?: string;
  @IsArray() @IsOptional() projects?: string[];
  @IsNumber() @IsOptional() openTasks?: number;
  @IsString() @IsOptional() since?: string;
  @IsString() @IsOptional() last?: string;
  @IsObject() @IsOptional() comply?: unknown;
}
