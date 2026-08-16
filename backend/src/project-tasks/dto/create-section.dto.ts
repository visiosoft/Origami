import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateSectionDto {
  @IsString() @IsOptional() id?: string;
  @IsNumber() projectId: number;
  @IsString() @IsOptional() name?: string;
  @IsNumber() @IsOptional() order?: number;
}
