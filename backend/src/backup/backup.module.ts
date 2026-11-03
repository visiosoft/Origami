import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeOrderEntity, MeetingEntity, ProjectEntity, ProjectTaskEntity, RfiEntity, TaskEntity } from '../database/entities';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { BackupController } from './backup.controller';
import { ProjectSheetService } from './project-sheet.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, ProjectTaskEntity, TaskEntity, RfiEntity, ChangeOrderEntity, MeetingEntity]), GoogleModule, SettingsModule, AuthModule],
  controllers: [BackupController],
  providers: [ProjectSheetService],
})
export class BackupModule {}
