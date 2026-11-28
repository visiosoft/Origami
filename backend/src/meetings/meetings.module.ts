import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeOrderEntity, MeetingEntity, PersonEntity, ProjectEntity, ProjectTaskEntity, RfiEntity, TaskEntity, UserEntity } from '../database/entities';
import { ProjectTasksModule } from '../project-tasks/project-tasks.module';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { GoogleNotesService } from './google-notes.service';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [TypeOrmModule.forFeature([MeetingEntity, TaskEntity, RfiEntity, ChangeOrderEntity, UserEntity, ProjectEntity, ProjectTaskEntity, PersonEntity]), AuthModule, TasksModule, GoogleModule, ProjectTasksModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, GoogleNotesService, CalendarSyncService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
