import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateCsiCodeDto {
  @IsString() @IsOptional() id?: string;
  @IsString() code: string;
  @IsString() division: string;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsNumber() @IsOptional() order?: number;
}
