import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePhaseDto {
  @IsString() @IsOptional() id?: string;
  @IsNumber() projectId: number;
  @IsString() @IsOptional() key?: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() color?: string;
  @IsNumber() @IsOptional() order?: number;
  @IsString() @IsOptional() startDate?: string;
  @IsString() @IsOptional() endDate?: string;
}
