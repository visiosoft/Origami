import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ChangeOrderEntity, ChecklistTemplateEntity, DealEntity, LeadEntity, ProjectEntity, TaskEntity, UserEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [NotificationsModule, TypeOrmModule.forFeature([TaskEntity, UserEntity, ChangeOrderEntity, ChecklistTemplateEntity, LeadEntity, DealEntity, ProjectEntity]), GoogleModule, AuthModule, SettingsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
