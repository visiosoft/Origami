import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { SettingsModule } from '../settings/settings.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadEntity, PersonEntity, SmsBatchEntity, SmsMessageEntity, SmsPreferenceEntity } from '../database/entities';
import { MassTextsService } from './mass-texts.service';
import { SmsPublicController } from './sms-public.controller';
import { SmsLogService } from './sms-log.service';

@Module({
  imports: [SettingsModule, TypeOrmModule.forFeature([SmsMessageEntity, SmsPreferenceEntity, SmsBatchEntity, PersonEntity, LeadEntity])],
  controllers: [SmsController, SmsPublicController],
  providers: [SmsService, SmsLogService, MassTextsService],
  exports: [SmsService],
})
export class SmsModule {}
