import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTaskEntity, ProjectSectionEntity, ProjectPhaseEntity, ProjectEntity, UserEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectTasksController } from './project-tasks.controller';
import { SectionsController } from './sections.controller';
import { PhasesController } from './phases.controller';
import { ProjectTasksService } from './project-tasks.service';
import { SectionsService } from './sections.service';
import { PhasesService } from './phases.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectTaskEntity, ProjectSectionEntity, ProjectPhaseEntity, ProjectEntity, UserEntity]), GoogleModule, AuthModule],
  controllers: [ProjectTasksController, SectionsController, PhasesController],
  providers: [ProjectTasksService, SectionsService, PhasesService],
})
export class ProjectTasksModule {}
