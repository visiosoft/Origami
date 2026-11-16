import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonEntity, TaskEntity, UserEntity } from '../database/entities';
import { SettingsModule } from '../settings/settings.module';
import { TasksModule } from '../tasks/tasks.module';
import { AuthModule } from '../auth/auth.module';
import { QuoTasksController, QuoWebhookController } from './quo.controller';
import { QuoTasksService } from './quo-tasks.service';

/** Quo tasks ↔ ODIN tasks (D6, Nov 15). */
@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, UserEntity, PersonEntity]), SettingsModule, TasksModule, AuthModule],
  controllers: [QuoWebhookController, QuoTasksController],
  providers: [QuoTasksService],
})
export class QuoModule {}
