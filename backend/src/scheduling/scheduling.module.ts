import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { CalendarService } from '../google/calendar.service';
import { GoogleModule } from '../google/google.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [GoogleModule, SettingsModule],
  controllers: [SchedulingController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class SchedulingModule {}
