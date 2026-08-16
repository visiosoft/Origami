import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';

export class CreateProjectTaskDto {
  @IsString() @IsOptional() id?: string;
  @IsNumber() projectId: number;
  @IsString() @IsOptional() sectionId?: string;
  @IsString() title: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() assignee?: string;
  @IsString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() priority?: string;
  @IsNumber() @IsOptional() order?: number;
  @IsBoolean() @IsOptional() completed?: boolean;
  @IsString() @IsOptional() parentId?: string | null;
  @IsArray() @IsOptional() attachments?: { name: string; url: string }[];
  @IsArray() @IsOptional() comments?: { id: string; author: string; text: string; date: string }[];
}
