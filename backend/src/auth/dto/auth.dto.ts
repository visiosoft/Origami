import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}

export class SetPasswordDto {
  @IsString() token: string;
  @IsString() @MinLength(8) password: string;
}

export class ForgotPasswordDto {
  @IsEmail() email: string;
}

export class NotificationPrefsDto {
  @IsBoolean() @IsOptional() notifyOnAssignment?: boolean;
  @IsBoolean() @IsOptional() notifyByEmail?: boolean;
  @IsBoolean() @IsOptional() notifyBySms?: boolean;
  @IsBoolean() @IsOptional() notifyOnOverdue?: boolean;
  @IsBoolean() @IsOptional() notifyOnMilestone?: boolean;
  @IsIn(['daily', 'weekly', 'off']) @IsOptional() digestFrequency?: string;
}
