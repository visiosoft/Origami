import { NotificationsModule } from '../notifications/notifications.module';
import { RfiMarkupsService } from './rfi-markups.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity, RfiEntity, RoleEntity, UserEntity , PdfMarkupEntity, MarkupLayerEntity } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { RfisService } from './rfis.service';
import { RfisController } from './rfis.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RfiEntity, ProjectEntity, UserEntity, RoleEntity, PdfMarkupEntity, MarkupLayerEntity]), AuthModule, GoogleModule, SettingsModule, NotificationsModule],
  controllers: [RfisController],
  providers: [RfiMarkupsService, RfisService, ManpowerAccess],
  exports: [RfisService],
})
export class RfisModule {}
