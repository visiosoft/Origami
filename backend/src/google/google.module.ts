import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { AttachmentsService } from './attachments.service';

// Service-only module: the Google controller lives in AuthModule so the OAuth
// callback can issue a session without a circular module dependency.
@Module({
  providers: [GoogleService, AttachmentsService],
  exports: [GoogleService, AttachmentsService],
})
export class GoogleModule {}
