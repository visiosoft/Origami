import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum UserTier {
  Internal = 'internal',
  Client = 'client',
  Consultant = 'consultant',
}

export enum UserStatus {
  Pending = 'pending',
  Active = 'active',
  Suspended = 'suspended',
}

export class CreateUserDto {
  @IsString() @IsOptional() id?: string;
  @IsString() name: string;
  @IsString() email: string;
  @IsEnum(UserTier) tier: UserTier;
  @IsString() roleKey: string;
  @IsEnum(UserStatus) @IsOptional() status?: UserStatus;
  @IsString() @IsOptional() lastLogin?: string;
}
