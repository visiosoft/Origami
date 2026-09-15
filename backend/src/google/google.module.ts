import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { AttachmentsService } from './attachments.service';
import { CalendarService } from './calendar.service';

// Service-only module: the Google controller lives in AuthModule so the OAuth
// callback can issue a session without a circular module dependency.
@Module({
  providers: [GoogleService, AttachmentsService, CalendarService],
  exports: [GoogleService, AttachmentsService, CalendarService],
})
export class GoogleModule {}
