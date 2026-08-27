import { IsString, IsNumber, IsOptional } from 'class-validator';

// Matches the Projects directory record (frontend data/projects.ts Project).
export class CreateProjectDto {
  @IsNumber() @IsOptional() id?: number;
  @IsString() name: string;
  @IsString() @IsOptional() priority?: string;
  @IsString() @IsOptional() location?: string;
  @IsString() @IsOptional() typeOfWork?: string;
  @IsString() @IsOptional() contractType?: string;
  @IsString() @IsOptional() contractAmt?: string;
  @IsString() @IsOptional() estStart?: string;
  @IsString() @IsOptional() duration?: string;
  @IsString() @IsOptional() scope?: string;
  @IsString() @IsOptional() stage?: string;
  @IsNumber() @IsOptional() progress?: number;
  @IsString() @IsOptional() referral?: string;
  @IsString() @IsOptional() contactedBy?: string;
  @IsString() @IsOptional() imgColor?: string;
  @IsString() @IsOptional() img?: string;
  @IsString() @IsOptional() designPhase?: string;
  @IsString() @IsOptional() leadId?: string;
  @IsString() @IsOptional() introLetterSentAt?: string;
}
