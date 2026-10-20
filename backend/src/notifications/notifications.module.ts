import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationItemEntity, PersonEntity, ProjectEntity, ProjectTaskEntity, RoleEntity, TaskEntity, UserEntity } from '../database/entities';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SettingsModule } from '../settings/settings.module';
import { GoogleModule } from '../google/google.module';
import { SmsModule } from '../sms/sms.module';
import { NotifyHub } from './notify-hub.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, ProjectEntity, RoleEntity, PersonEntity, NotificationItemEntity, ProjectTaskEntity, TaskEntity]), SettingsModule, GoogleModule, SmsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotifyHub],
  exports: [NotificationsService, NotifyHub],
})
export class NotificationsModule {}
