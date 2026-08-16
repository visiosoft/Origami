import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateWorkflowItemDto {
  @IsString() @IsOptional() id?: string;
  @IsString() workflowId: string;
  @IsString() title: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() notes?: string;
  @IsNumber() @IsOptional() order?: number;
}
