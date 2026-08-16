import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateFaqDto {
  @IsString() @IsOptional() id?: string;
  @IsString() question: string;
  @IsString() answer: string;
  @IsString() @IsOptional() category?: string;
  @IsNumber() @IsOptional() order?: number;
}
