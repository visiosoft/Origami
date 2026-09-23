import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString() @IsOptional() id?: string;
  @IsString() employeeId: string;
  @IsString() type: string;
  @IsString() startDate: string;
  @IsString() endDate: string;
  @IsNumber() @IsOptional() hours?: number;
  @IsString() @IsOptional() reason?: string;
}

export class DecideLeaveRequestDto {
  @IsString() @IsOptional() note?: string;
}
