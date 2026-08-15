import { IsString, IsOptional, IsArray, IsNumber, IsObject } from 'class-validator';

// Matches the People directory record (frontend data/people.ts Person).
export class CreatePersonDto {
  @IsNumber() @IsOptional() id?: number;
  @IsString() name: string;
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
