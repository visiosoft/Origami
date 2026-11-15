import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingEntity } from '../database/entities';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { StatusController } from './status.controller';
import { BrandController } from './brand.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppSettingEntity])],
  controllers: [SettingsController, StatusController, BrandController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
