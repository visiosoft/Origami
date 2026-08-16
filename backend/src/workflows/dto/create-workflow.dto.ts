import { IsString, IsOptional } from 'class-validator';

export class CreateWorkflowDto {
  @IsString() @IsOptional() id?: string;
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() owner?: string;
}
