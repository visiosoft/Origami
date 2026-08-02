import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateDealDto {
  @IsString()
  name: string;

  @IsString()
  client: string;

  @IsNumber()
  value: number;

  @IsString()
  @IsOptional()
  stage?: string;

  @IsString()
  @IsOptional()
  owner?: string;
}
