import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [GoogleModule, SettingsModule],
  controllers: [SchedulingController],
})
export class SchedulingModule {}
