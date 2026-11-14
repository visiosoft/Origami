import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeOrderEntity, MeetingEntity, RfiEntity, TaskEntity, UserEntity } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { GoogleNotesService } from './google-notes.service';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [TypeOrmModule.forFeature([MeetingEntity, TaskEntity, RfiEntity, ChangeOrderEntity, UserEntity]), AuthModule, TasksModule, GoogleModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, GoogleNotesService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
