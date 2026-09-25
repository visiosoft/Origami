import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity, RfiEntity, RoleEntity, UserEntity } from '../database/entities';
import { AuthModule } from '../auth/auth.module';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { ManpowerAccess } from '../manpower/manpower-access.service';
import { RfisService } from './rfis.service';
import { RfisController } from './rfis.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RfiEntity, ProjectEntity, UserEntity, RoleEntity]), AuthModule, GoogleModule, SettingsModule],
  controllers: [RfisController],
  providers: [RfisService, ManpowerAccess],
  exports: [RfisService],
})
export class RfisModule {}
