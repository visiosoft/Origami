import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

/** ValidationPipe runs with `whitelist: true` -- every field must be declared here. */
export class CreateEmployeeDto {
  @IsString() @IsOptional() id?: string;
  @IsString() name: string;
  @IsString() @IsOptional() jobTitle?: string;
  @IsString() @IsOptional() trade?: string;
  @IsArray() @IsOptional() expertise?: string[];
  @IsString() @IsOptional() payType?: string;
  @IsNumber() @IsOptional() payRate?: number;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() hireDate?: string;
  @IsString() @IsOptional() status?: string;
  @IsString() @IsOptional() supervisorId?: string | null;
  @IsString() @IsOptional() userId?: string | null;
}
