import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export enum ProjectPhase {
  Design = 'Design',
  Preconstruction = 'Preconstruction',
  Construction = 'Construction',
  Closeout = 'Closeout',
}

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsString()
  client: string;

  @IsEnum(ProjectPhase)
  phase: ProjectPhase;

  @IsNumber()
  contractValue: number;

  @IsString()
  @IsOptional()
  exec?: string;

  @IsString()
  @IsOptional()
  contractType?: string;
}
