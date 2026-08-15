import { IsString, IsOptional, IsEnum, IsObject, IsNumber, IsBoolean } from 'class-validator';
import { UserTier } from './create-user.dto';

export class CreateRoleDto {
  @IsString() @IsOptional() key?: string;
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;
  @IsEnum(UserTier) tier: UserTier;
  @IsNumber() @IsOptional() order?: number;
  @IsBoolean() @IsOptional() isSystem?: boolean;
  @IsObject() @IsOptional() permissions?: Record<string, { view: boolean; manage: boolean }>;
}
