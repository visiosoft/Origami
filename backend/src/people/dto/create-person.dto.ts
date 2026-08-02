import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum PersonKind {
  Internal = 'Internal',
  Client = 'Client',
  Consultant = 'Consultant',
  Subcontractor = 'Subcontractor',
  Vendor = 'Vendor',
}

export class CreatePersonDto {
  @IsString()
  name: string;

  @IsEnum(PersonKind)
  kind: PersonKind;

  @IsString()
  role: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsOptional()
  projects?: string[];

  @IsString()
  @IsOptional()
  complianceDate?: string;
}
