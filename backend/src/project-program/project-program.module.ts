import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectProgramEntity, ProjectEntity } from '../database/entities';
import { ProjectProgramService } from './project-program.service';
import { ProjectProgramController } from './project-program.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectProgramEntity, ProjectEntity])],
  controllers: [ProjectProgramController],
  providers: [ProjectProgramService],
  exports: [ProjectProgramService],
})
export class ProjectProgramModule {}
