import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateSectionDto {
  @IsString() @IsOptional() id?: string;
  @IsOptional() @IsNumber() projectId: number | null;
  @IsString() @IsOptional() name?: string;
  @IsNumber() @IsOptional() order?: number;
}
