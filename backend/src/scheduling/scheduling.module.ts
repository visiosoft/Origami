import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [GoogleModule, SettingsModule, AuthModule],
  controllers: [SchedulingController],
})
export class SchedulingModule {}
