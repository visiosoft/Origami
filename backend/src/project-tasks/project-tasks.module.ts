import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTaskEntity, ProjectSectionEntity } from '../database/entities';
import { ProjectTasksController } from './project-tasks.controller';
import { SectionsController } from './sections.controller';
import { ProjectTasksService } from './project-tasks.service';
import { SectionsService } from './sections.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectTaskEntity, ProjectSectionEntity])],
  controllers: [ProjectTasksController, SectionsController],
  providers: [ProjectTasksService, SectionsService],
})
export class ProjectTasksModule {}
