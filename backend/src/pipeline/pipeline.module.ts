import { NotificationsModule } from '../notifications/notifications.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { DealEntity, LeadEntity } from '../database/entities';
import { ProjectsModule } from '../projects/projects.module';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { ProjectTasksModule } from '../project-tasks/project-tasks.module';

@Module({
  imports: [TypeOrmModule.forFeature([DealEntity, LeadEntity]), AuthModule, ProjectsModule, TasksModule, ProjectTasksModule, NotificationsModule],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
