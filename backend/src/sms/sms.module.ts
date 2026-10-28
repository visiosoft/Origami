import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { SettingsModule } from '../settings/settings.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsMessageEntity } from '../database/entities';
import { SmsLogService } from './sms-log.service';

@Module({
  imports: [SettingsModule, TypeOrmModule.forFeature([SmsMessageEntity])],
  controllers: [SmsController],
  providers: [SmsService, SmsLogService],
  exports: [SmsService],
})
export class SmsModule {}
