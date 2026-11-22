import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadEntity, MeetingEntity, PersonEntity, ProjectEntity, TaskEntity, UserEntity } from '../database/entities';
import { MeetingsModule } from '../meetings/meetings.module';
import { QuoCallsService } from './quo-calls.service';
import { SettingsModule } from '../settings/settings.module';
import { TasksModule } from '../tasks/tasks.module';
import { AuthModule } from '../auth/auth.module';
import { QuoCallsController, QuoTasksController, QuoWebhookController } from './quo.controller';
import { QuoTasksService } from './quo-tasks.service';

/** Quo tasks ↔ ODIN tasks (D6, Nov 15). */
@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, UserEntity, PersonEntity, MeetingEntity, LeadEntity, ProjectEntity]), SettingsModule, TasksModule, AuthModule, MeetingsModule],
  controllers: [QuoWebhookController, QuoTasksController, QuoCallsController],
  providers: [QuoTasksService, QuoCallsService],
})
export class QuoModule {}
