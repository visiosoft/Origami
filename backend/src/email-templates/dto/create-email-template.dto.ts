import { IsString, IsOptional } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString() @IsOptional() id?: string;
  @IsString() @IsOptional() key?: string;
  @IsString() name: string;
  @IsString() @IsOptional() subject?: string;
  @IsString() body: string;
  @IsString() @IsOptional() kind?: string;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() updatedAt?: string;
}
