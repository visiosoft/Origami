import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFolderDto {
  @IsNumber() projectId: number;
  @IsArray() @IsOptional() path?: string[];
  @IsString() name: string;
}

/** Patch a file record. Both fields optional so either can be saved alone. */
export class UpdateFileDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() notes?: string;
}

/** Move a file to another folder of its project ([] = the project's top level). */
export class MoveFileDto {
  @IsArray() @IsString({ each: true }) folderPath: string[];
}

export class EmailFileDto {
  @IsString() to: string;
  @IsString() @IsOptional() note?: string;
}
