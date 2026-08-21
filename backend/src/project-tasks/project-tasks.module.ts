import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectTaskEntity, ProjectSectionEntity, UserEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectTasksController } from './project-tasks.controller';
import { SectionsController } from './sections.controller';
import { ProjectTasksService } from './project-tasks.service';
import { SectionsService } from './sections.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectTaskEntity, ProjectSectionEntity, UserEntity]), GoogleModule, AuthModule],
  controllers: [ProjectTasksController, SectionsController],
  providers: [ProjectTasksService, SectionsService],
})
export class ProjectTasksModule {}
