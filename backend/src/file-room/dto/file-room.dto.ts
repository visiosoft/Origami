import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFolderDto {
  @IsNumber() projectId: number;
  @IsArray() @IsOptional() path?: string[];
  @IsString() name: string;
}

export class RenameFileDto {
  @IsString() name: string;
}

export class EmailFileDto {
  @IsString() to: string;
  @IsString() @IsOptional() note?: string;
}
